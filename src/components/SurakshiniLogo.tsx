interface SurakshiniLogoProps {
  size?: number;
  className?: string;
}

export function SurakshiniLogo({ size = 32, className = '' }: SurakshiniLogoProps) {
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-xl ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          width="40"
          height="40"
          rx="11"
          className="fill-[#2563EB] dark:fill-[#3B82F6]"
        />
        <path
          d="M12.5 15.5C12.5 13.567 14.067 12 16 12H24C25.933 12 27.5 13.567 27.5 15.5V21.5C27.5 23.433 25.933 25 24 25H18.5L14 28.5V24.65C13.08 24.02 12.5 22.84 12.5 21.5V15.5Z"
          fill="#FFFFFF"
        />
        <circle cx="16.8" cy="18.5" r="1.25" className="fill-[#2563EB] dark:fill-[#1E293B]" />
        <circle cx="20" cy="18.5" r="1.25" className="fill-[#2563EB] dark:fill-[#1E293B]" />
        <circle cx="23.2" cy="18.5" r="1.25" className="fill-[#2563EB] dark:fill-[#1E293B]" />
      </svg>
    </div>
  );
}
