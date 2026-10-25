import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
}) => {
  return (
    <div
      className={`bg-industrial-900 border border-steel-800 rounded-xl p-5 shadow-lg backdrop-blur-sm transition-all duration-200 ${className}`}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-steel-800/80">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-steel-100 flex items-center gap-2">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-steel-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
