import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'ssc' | 'rrb' | 'open' | 'opening' | 'closing' | 'ineligible' | 'eligible' | 'neutral' | 'info';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral',
  size = 'md' 
}) => {
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-2.5 py-1 text-xs font-semibold';

  const variantMap: Record<string, string> = {
    ssc: 'bg-blue-50 text-blue-700 border-blue-200 border',
    rrb: 'bg-purple-50 text-purple-700 border-purple-200 border',
    open: 'bg-emerald-50 text-emerald-700 border-emerald-200 border',
    opening: 'bg-indigo-50 text-indigo-700 border-indigo-200 border',
    closing: 'bg-amber-50 text-amber-800 border-amber-200 border',
    ineligible: 'bg-rose-50 text-rose-700 border-rose-200 border',
    eligible: 'bg-teal-50 text-teal-700 border-teal-200 border',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 border',
    info: 'bg-sky-50 text-sky-700 border-sky-200 border',
  };

  return (
    <span className={`inline-flex items-center rounded-md font-medium tracking-wide ${sizeClasses} ${variantMap[variant] || variantMap.neutral}`}>
      {children}
    </span>
  );
};
