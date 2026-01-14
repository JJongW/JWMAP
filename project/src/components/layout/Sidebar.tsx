interface SidebarProps {
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function Sidebar({
  children,
  width = 'w-96',
  className = '',
}: SidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 ${width} bg-white shadow-xl z-40 flex flex-col overflow-hidden ${className}`}
    >
      {children}
    </aside>
  );
}
