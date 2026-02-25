import * as React from "react";

import { cn } from "./utils";

// Simple chart context without recharts dependency
const ChartContext = React.createContext<{ config?: any } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: any;
  children: React.ReactNode;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          data-chart={chartId}
          ref={ref}
          className={cn(
            "flex aspect-video justify-center text-xs",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = "ChartContainer";

// Simple placeholder components
const ChartTooltip = ({ children, ...props }: any) => <div {...props}>{children}</div>;
const ChartTooltipContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;
const ChartLegend = ({ children, ...props }: any) => <div {...props}>{children}</div>;
const ChartLegendContent = ({ children, ...props }: any) => <div {...props}>{children}</div>;

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
};
