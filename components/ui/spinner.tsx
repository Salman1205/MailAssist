import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      {...props}
    >
      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
      <div className="h-2 w-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
    </div>
  )
}

export { Spinner }
