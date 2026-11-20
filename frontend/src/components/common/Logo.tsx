interface Props { className?: string; height?: number }

/** Original supplied emblem. Aspect ratio preserved (height drives width). Screen blend lets the original navy background merge with the app. */
export function Emblem({ height = 40, className = '' }: Props) {
  return <img src="/assets/emblem.png" alt="FixSaathi emblem" style={{ height, width: 'auto' }} className={`select-none ${className}`} draggable={false} />
}

export function Wordmark({ height = 28, className = '' }: Props) {
  return <img src="/assets/wordmark.png" alt="FixSaathi" style={{ height, width: 'auto' }} className={`select-none ${className}`} draggable={false} />
}
