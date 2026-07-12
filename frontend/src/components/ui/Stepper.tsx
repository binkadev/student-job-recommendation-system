interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const active = index <= currentStep;
        return (
          <li key={step} className={`rounded-lg border p-3 text-sm ${active ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-500"}`}>
            <span className="font-semibold">Bước {index + 1}</span>
            <p>{step}</p>
          </li>
        );
      })}
    </ol>
  );
}
