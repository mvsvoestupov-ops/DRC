import React from "react";
import { Check, Circle } from "lucide-react";

function Steps({ current, children }) {
  return (
    <div className="flex items-start flex-wrap gap-0">
      {React.Children.map(children, (child, index) => {
        const isCompleted = index < current;
        const isActive = index === current;

        return (
          <React.Fragment key={index}>
            {/* Step */}
            <div className={`flex items-center gap-2 flex-shrink-0 py-2 ${
              index > 0 ? "ml-4" : ""
            }`}>
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                ${isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary/20' : ''}
                ${!isCompleted && !isActive ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {isCompleted ? <Check className="w-4 h-4" /> : (index + 1)}
              </div>
              <span className={`text-sm ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                {child.props.title || `Шаг ${index + 1}`}
              </span>
            </div>
            {/* Connector */}
            {index < React.Children.count(children) - 1 && (
              <div className={`flex-1 border-t-2 mt-5 mx-2 ${
                index < current ? 'border-primary' : 'border-muted'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Step({ title }) {
  return null; // используется только через props.title в Steps
}

export { Steps, Step };
