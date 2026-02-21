import React from 'react';

function SvgIcon({ size = 18, className, children, stroke = 1.9 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DuckIcon({ size = 18, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13 5.2a4.2 4.2 0 0 0-4.2 4.2V10H7.2a2.2 2.2 0 1 0 0 4.4h1.95A5.2 5.2 0 0 0 14 17.6h1.4A4.6 4.6 0 0 0 20 13c0-2.54-2.06-4.6-4.6-4.6h-.8A4.18 4.18 0 0 0 13 5.2Z"
        fill="currentColor"
      />
      <circle cx="13.1" cy="9.8" r="0.8" fill="#0f172a" />
      <path d="M5.6 11.4h3.2v2.2H5.6a1.1 1.1 0 1 1 0-2.2Z" fill="#f59e0b" />
    </svg>
  );
}

export function HomeIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.8V20h13V9.8" />
      <path d="M10 20v-5.2h4V20" />
    </SvgIcon>
  );
}

export function SearchIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m20 20-4.2-4.2" />
    </SvgIcon>
  );
}

export function BellIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M6.8 10.2A5.2 5.2 0 0 1 12 5a5.2 5.2 0 0 1 5.2 5.2V13l1.6 2.6H5.2L6.8 13v-2.8Z" />
      <path d="M10 17.2a2 2 0 0 0 4 0" />
    </SvgIcon>
  );
}

export function MessageIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4.6 6.2h14.8a1.8 1.8 0 0 1 1.8 1.8v8.2a1.8 1.8 0 0 1-1.8 1.8h-8l-4.4 3v-3H4.6a1.8 1.8 0 0 1-1.8-1.8V8a1.8 1.8 0 0 1 1.8-1.8Z" />
    </SvgIcon>
  );
}

export function UserIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.5 19c.9-3 3.3-4.8 6.5-4.8S17.6 16 18.5 19" />
    </SvgIcon>
  );
}

export function PlusIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </SvgIcon>
  );
}

export function ChevronDownIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </SvgIcon>
  );
}

export function UsersIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="16.5" cy="10.2" r="2.1" />
      <path d="M4.8 18.2c.8-2.6 2.5-4 4.8-4s4.1 1.4 4.9 4" />
      <path d="M14.2 18.2c.5-1.7 1.7-2.8 3.5-3.1" />
    </SvgIcon>
  );
}

export function HeartIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M12 20s-6.6-4.3-8.4-8.2C2.2 8.6 4.1 5.8 7 5.8c2 0 3.2 1.1 5 3 1.8-1.9 3-3 5-3 2.9 0 4.8 2.8 3.4 6-1.8 3.9-8.4 8.2-8.4 8.2Z" />
    </SvgIcon>
  );
}

export function CommentIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M4.8 6.5h14.4a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2h-8l-4.4 3v-3H4.8a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />
    </SvgIcon>
  );
}

export function ShareIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M13 5h6v6" />
      <path d="m19 5-9 9" />
      <path d="M19 13.5V19H5V5h5.5" />
    </SvgIcon>
  );
}

export function ImageIcon(props) {
  return (
    <SvgIcon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="m6.5 17 4.6-4.8 2.7 2.8 2.7-2.8 1.9 2" />
    </SvgIcon>
  );
}

export function PollIcon(props) {
  return (
    <SvgIcon {...props}>
      <path d="M5 18V10" />
      <path d="M12 18V6" />
      <path d="M19 18v-4" />
    </SvgIcon>
  );
}

export function SmileIcon(props) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.2 14.2c.8 1.2 1.7 1.8 2.8 1.8 1.1 0 2-.6 2.8-1.8" />
      <path d="M9.4 10h.01" />
      <path d="M14.6 10h.01" />
    </SvgIcon>
  );
}
