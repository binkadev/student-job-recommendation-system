package com.tttn.jobrecommendation.integration;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

/** Loopback-only transport faults for the disposable browser fixture. No production hooks. */
final class ReliabilityFaultProxy implements AutoCloseable {
    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(2)).build();
    private final java.util.concurrent.ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final String upstreamAi;
    private HttpServer ai;
    private java.net.ServerSocket resetListener;
    private final HttpServer gateway;
    private int aiPort;
    volatile String aiMode = "pass", publicMode = "pass";
    volatile String backend;
    Supplier<String> evidence = () -> "{}";
    final AtomicInteger aiRequests = new AtomicInteger(), publicGenerations = new AtomicInteger(), jwtLeaks = new AtomicInteger(), heldRequests = new AtomicInteger();

    ReliabilityFaultProxy(String upstreamAi) throws IOException {
        this.upstreamAi = upstreamAi;
        startAi();
        gateway = server(0);
        gateway.createContext("/control", exchange -> {
            if (!exchange.getRequestMethod().equals("POST")) { send(exchange, 405, "{}"); return; }
            String command = new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            synchronized (this) {
                if (command.startsWith("ai:")) {
                    String mode = command.substring(3);
                    if (!java.util.Set.of("pass", "offline", "500", "503", "slow", "hold", "reset", "malformed", "missing").contains(mode)) {
                        send(exchange, 400, "{}"); return;
                    }
                    aiMode = mode;
                    if (mode.equals("offline") || mode.equals("reset")) {
                        stopAi();
                        if (mode.equals("reset")) {
                            var listener = new java.net.ServerSocket();
                            listener.setReuseAddress(true);
                            listener.bind(new InetSocketAddress("127.0.0.1", aiPort));
                            resetListener = listener;
                            executor.submit(() -> {
                                while (!listener.isClosed()) try (var socket = listener.accept()) {
                                    aiRequests.incrementAndGet(); socket.setSoLinger(true, 0);
                                } catch (IOException e) { if (!listener.isClosed()) throw new IllegalStateException(e); }
                            });
                        }
                    } else {
                        if (resetListener != null) { resetListener.close(); resetListener = null; }
                        if (ai == null) startAi();
                    }
                } else if (command.startsWith("public:")) {
                    String mode = command.substring(7);
                    if (!java.util.Set.of("pass", "drop", "delay", "hold").contains(mode)) { send(exchange, 400, "{}"); return; }
                    publicMode = mode;
                } else { send(exchange, 400, "{}"); return; }
            }
            send(exchange, 200, "{}");
        });
        gateway.createContext("/evidence", exchange -> send(exchange, 200, evidence.get()));
        gateway.createContext("/", this::publicRequest);
        gateway.start();
    }
    private HttpServer server(int port) throws IOException {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.setExecutor(executor); return server;
    }
    private void startAi() throws IOException {
        ai = server(aiPort); aiPort = ai.getAddress().getPort();
        ai.createContext("/", this::aiRequest); ai.start();
    }
    private void stopAi() throws IOException {
        if (ai != null) { ai.stop(0); ai = null; }
        if (resetListener != null) { resetListener.close(); resetListener = null; }
    }
    String aiUrl() { return "http://127.0.0.1:" + aiPort; }
    String gatewayUrl() { return "http://127.0.0.1:" + gateway.getAddress().getPort(); }
    private void aiRequest(HttpExchange exchange) throws IOException {
        aiRequests.incrementAndGet();
        if (exchange.getRequestHeaders().containsKey("Authorization")) jwtLeaks.incrementAndGet();
        String mode = aiMode;
        if (mode.equals("500") || mode.equals("503")) { send(exchange, Integer.parseInt(mode), "{}"); return; }
        if (mode.equals("malformed")) { send(exchange, 200, "{broken"); return; }
        if (mode.equals("missing")) { send(exchange, 200, "{\"results\":[]}"); return; }
        pause(mode.equals("slow") ? 20_000 : mode.equals("hold") ? 2000 : 0);
        forward(exchange, upstreamAi, false, "pass");
    }
    private void publicRequest(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        boolean generate = exchange.getRequestMethod().equals("POST") &&
                (path.endsWith("/recommendations/generate") || path.endsWith("/candidate-ranking-runs"));
        if (generate) publicGenerations.incrementAndGet();
        String mode = publicMode;
        boolean hold = mode.equals("hold") && path.equals("/api/students/me");
        if (hold) {
            publicMode = "pass";
            heldRequests.incrementAndGet();
            pause(2000);
        }
        if (generate && (mode.equals("drop") || mode.equals("delay"))) publicMode = "pass";
        forward(exchange, backend, generate, mode);
        if (hold) heldRequests.decrementAndGet();
    }
    private void forward(HttpExchange exchange, String target, boolean generate, String mode) throws IOException {
        try {
            var request = HttpRequest.newBuilder(URI.create(target + exchange.getRequestURI())).timeout(Duration.ofSeconds(35));
            for (String key : java.util.List.of("Content-Type", "Authorization", "If-Match", "X-Internal-Api-Key", "X-Request-Id"))
                if (exchange.getRequestHeaders().getFirst(key) != null) request.header(key, exchange.getRequestHeaders().getFirst(key));
            var response = client.send(request.method(exchange.getRequestMethod(), HttpRequest.BodyPublishers.ofByteArray(exchange.getRequestBody().readAllBytes())).build(), HttpResponse.BodyHandlers.ofByteArray());
            if (generate && mode.equals("drop")) { exchange.close(); return; }
            if (generate && mode.equals("delay")) pause(42_000); // Backend has already committed; browser's normal 40s timeout expires.
            response.headers().firstValue("ETag").ifPresent(value -> exchange.getResponseHeaders().set("ETag", value));
            response.headers().firstValue("X-Request-Id").ifPresent(value -> exchange.getResponseHeaders().set("X-Request-Id", value));
            exchange.getResponseHeaders().set("Content-Type", response.headers().firstValue("Content-Type").orElse("application/json"));
            byte[] body = response.body();
            exchange.sendResponseHeaders(response.statusCode(), body.length); exchange.getResponseBody().write(body);
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        catch (IOException e) { exchange.close(); }
        finally { exchange.close(); }
    }
    private static void pause(long millis) {
        if (millis == 0) return;
        try { Thread.sleep(millis); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
    private static void send(HttpExchange exchange, int status, String value) throws IOException {
        byte[] bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
    }
    @Override public void close() throws IOException { stopAi(); gateway.stop(0); executor.shutdownNow(); }
}
