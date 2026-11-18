interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="neo-page-header mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#0C111C] sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#4B5C73]">{description}</p>
    </div>
  );
}
