import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="h-full w-full bg-zinc-900 flex flex-col text-white">
      {children}
    </div>
  );
};