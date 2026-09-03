declare module 'apexcharts' {
    namespace ApexCharts {
        interface ApexOptions {
            [key: string]: any;
        }
    }
    class ApexCharts {
        constructor(el: Element | null, options: ApexCharts.ApexOptions);
        render(): Promise<void>;
        updateOptions(options: any, redrawPaths?: boolean, animate?: boolean, updateSyncedCharts?: boolean): Promise<void>;
        updateSeries(newSeries: any, animate?: boolean): Promise<void>;
        destroy(): void;
    }
    export default ApexCharts;
}
