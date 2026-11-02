interface StepperProps {
  steps: string[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <ol aria-label="Các bước thực hiện" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {steps.map((step, index) => {
        const active = index <= currentStep;
        return (
          <li key={step} aria-current={index === currentStep ? "step" : undefined} className={`rounded-xl border p-3 text-sm ${active ? "border-brand-200 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-500"}`}>
            <span className="font-semibold">Bước {index + 1}</span>
            <p>{step}</p>
          </li>
        );
      })}
    </ol>
  );
}
