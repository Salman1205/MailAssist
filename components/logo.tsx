export default function Logo({
  size = "default",
  showText = false,
}: { size?: "default" | "small" | "large"; showText?: boolean }) {
  const sizeClasses = {
    small: "w-6 h-6",
    default: "w-8 h-8",
    large: "w-14 h-14",
  }

  const textSizes = {
    small: "text-xs",
    default: "text-sm",
    large: "text-xl",
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-lg bg-primary flex items-center justify-center flex-shrink-0`}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
          <path
            d="M3 4C3 2.89543 3.89543 2 5 2H19C20.1046 2 21 2.89543 21 4V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V4Z"
            fill="white"
            fillOpacity="0.1"
          />
          <path d="M7 8L12 14L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 16H17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      {showText && <span className={`font-bold text-foreground ${textSizes[size]}`}>Mail Assistant</span>}
    </div>
  )
}
