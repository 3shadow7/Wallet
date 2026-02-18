import { Component, ElementRef, ViewChild, AfterViewInit, inject, ChangeDetectionStrategy, effect, OnDestroy, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { MonthSliderComponent, SliderRange } from '@shared/components/month-slider/month-slider.component';
import { MultiSelectComponent } from '@shared/components/multi-select/multi-select.component';
import { SingleSelectComponent } from '@shared/components/single-select/single-select.component';
import { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { SavingsService, MonthlyRecord } from '@core/services/savings.service';
import ApexCharts from 'apexcharts';
import { ThemeService } from '@core/services/theme.service';

import { BudgetStateService } from '@core/state/budget-state.service';
import { ExpenseItem } from '@core/domain/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, AgGridAngular, FormsModule, MonthSliderComponent, MultiSelectComponent, SingleSelectComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryComponent implements AfterViewInit, OnDestroy {
  private savingsService = inject(SavingsService);
  private budgetState = inject(BudgetStateService);
  private platformId = inject(PLATFORM_ID);
  public themeService = inject(ThemeService); // Made public for template if needed
  
  isBrowser = isPlatformBrowser(this.platformId);
  breakdownMode: 'type' | 'priority' = 'type';

  // Signals
  totalSavings = this.savingsService.totalSavingsSignal;
  history = this.savingsService.historySignal;
  detailedHistory = this.budgetState.historySignal;
  avgSavingsRate = this.savingsService.averageSavingsRate;
  
  bestMonth = () => {
      const h = this.history();
      if (!h.length) return null;
      return h.reduce((prev, current) => (prev.transferredToSavings > current.transferredToSavings) ? prev : current);
  };

  // Chart References
  @ViewChild('savingsChart') savingsChartEl!: ElementRef;
  @ViewChild('expensesChart') expensesChartEl!: ElementRef;
  @ViewChild('breakdownChart') breakdownChartEl!: ElementRef;
  @ViewChild('itemChart') itemChartEl!: ElementRef;

  private sChart: ApexCharts | null = null;
  private eChart: ApexCharts | null = null;
  private bChart: ApexCharts | null = null;
  private iChart: ApexCharts | null = null;
  
  // Interactive Selection
  selectedMonths = signal<string[]>([]);

  // Advance Filters
  selectedYear = signal<string>(new Date().getFullYear().toString());
  
  // Multi-select signals
  filterType = signal<string[]>(['Fixed', 'Variable', 'Savings']);
  filterPriority = signal<string[]>(['Must Have', 'Need', 'Want', 'Emergency', 'Gift']);

  availableTypes = ['Fixed', 'Variable', 'Savings'];
  availablePriorities = ['Must Have', 'Need', 'Want', 'Emergency', 'Gift'];

  // Computed: Years Available
  availableYears = computed(() => {
      const h = this.detailedHistory();
      const years = new Set<string>();
      if (h.length === 0) return [new Date().getFullYear().toString()];

      h.forEach(record => {
          // Format expected: "YYYY-MM"
          const parts = record.month.split('-');
          if (parts.length >= 2) {
              years.add(parts[0]);
          } else {
              // Fallback or legacy format handling
              const spaceParts = record.month.split(' ');
              if (spaceParts.length > 1) years.add(spaceParts[1]);
              else years.add(new Date().getFullYear().toString());
          }
      });
      return Array.from(years).sort().reverse(); 
  });

  // Computed: Months for buttons based on selected year
  monthsForYear = computed(() => {
      const y = this.selectedYear();
      return this.detailedHistory().filter(d => {
          // If month string has year, check match
          // Expected "YYYY-MM" -> we check if it starts with YYYY
          if (d.month.startsWith(y + '-')) return true;
          
          // Legacy support (e.g. "January 2024")
          if (d.month.includes(y)) return true;
          
          return false;
      });
  });

  // Grid Config
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    flex: 1
  };

  colDefs: ColDef[] = [
    { field: 'month', headerName: 'Month', sort: 'desc' },
    { 
        field: 'income', 
        headerName: 'Income', 
        valueFormatter: p => `$${p.value.toFixed(2)}`
    },
    { 
        field: 'expenses', 
        headerName: 'Expenses',
        valueFormatter: p => `$${p.value.toFixed(2)}`
    },
    { 
        field: 'freeMoney', 
        headerName: 'Free Money (Net)',
        cellStyle: params => params.value > 0 ? { color: 'green' } : { color: 'red' },
        valueFormatter: p => `$${p.value.toFixed(2)}`
    },
    { 
        field: 'transferredToSavings', 
        headerName: 'From Budget',
        cellStyle: params => params.value < 0 ? { color: 'var(--danger-color)', fontWeight: 'bold' } : { color: 'var(--primary-color)', fontWeight: 'bold' },
        valueFormatter: p => p.value < 0 ? `${p.value.toFixed(2)} (Deficit)` : `$${p.value.toFixed(2)}`
    },
    { 
        field: 'manualAdded', 
        headerName: 'Direct Additions',
        cellStyle: { fontWeight: 'bold', color: '#f59e0b' }, // Amber for manual
        valueFormatter: p => p.value ? `$${p.value.toFixed(2)}` : '--'
    },
    { 
        field: 'savingsTotalAfterTransfer', 
        headerName: 'Total Savings Balance',
        valueFormatter: p => `$${p.value.toFixed(2)}`
    }
  ];

  constructor() {
      // Re-render charts when history changes
      effect(() => {
          if (!this.isBrowser) return;

          const data = this.history();
          if (this.sChart && this.eChart && this.bChart) {
              this.updateCharts(data);
              this.updateBreakdownChart();
          }

          // Auto-select latest month ONLY on initial data load (if nothing selected yet)
          // We check if this is the "first" load by seeing if we have data but no selection
          if (data.length > 0 && this.selectedMonths().length === 0 && !this.userHasInteractedWithSlider) {
             this.selectedMonths.set([data[data.length - 1].month]);
          }
      }, { allowSignalWrites: true });

      // Theme Change Effect
      effect(() => {
          if (!this.isBrowser) return;
          const isDark = this.themeService.isDark();
          
          this.updateChartTheme(isDark);
      });

      // Update Item Treemap when ANY selection changes
      effect(() => {
        if (!this.isBrowser) return;
        
        // Track dependencies
        const selected = this.selectedMonths();
        const type = this.filterType();
        const prio = this.filterPriority();
        const year = this.selectedYear(); // Ensure effect runs on year change too
        
        console.log('Update Effect Triggered:', { selected, type, prio, year });

        if (this.iChart) {
            this.updateItemChart();
        }
      });
  }

  // State to track if user has manually filtered
  private userHasInteractedWithSlider = false;

  private updateChartTheme(isDark: boolean) {
      const themeMode = isDark ? 'dark' : 'light';
      const textColor = isDark ? '#e2e8f0' : '#1e293b'; 
      const gridColor = isDark ? '#334155' : '#e2e8f0';

      const commonOptions = {
          chart: {
              foreColor: textColor
          },
          grid: {
              borderColor: gridColor
          },
          tooltip: {
              theme: themeMode,
              style: {
                fontSize: '12px',
                fontFamily: undefined
              },
          },
          xaxis: {
             labels: { style: { colors: textColor } }
          },
          yaxis: {
             labels: { style: { colors: textColor } }
          },
          title: {
             style: { color: textColor }
          },
          // Ensure data labels contrast correctly
          dataLabels: {
              style: { colors: [isDark ? '#e2e8f0' : '#1e293b'] }
          }
      };

      if (this.sChart) this.sChart.updateOptions(commonOptions);
      if (this.eChart) this.eChart.updateOptions(commonOptions);
      
      if (this.bChart) {
          this.bChart.updateOptions({
            ...commonOptions,
            plotOptions: {
              bar: {
                dataLabels: {
                  total: {
                    style: { color: textColor }
                  }
                }
              }
            }
          });
      }
      
      if (this.iChart) {
          // Treemap title needs specific update
          this.iChart.updateOptions({
              ...commonOptions,
              title: {
                 style: { color: textColor }
              }
              // Treemap dataLabels are usually white on colored blocks, so we don't override them with text color
          });
      }
  }

  ngAfterViewInit() {
      if (!this.isBrowser) return;

      // Small delay to ensure container exists
      setTimeout(() => this.initCharts(), 100);
      setTimeout(() => this.initBreakdownChart(), 150);
      setTimeout(() => this.initItemChart(), 200);
  }

  ngOnDestroy() {
      if (this.sChart) this.sChart.destroy();
      if (this.eChart) this.eChart.destroy();
      if (this.bChart) this.bChart.destroy();
      if (this.iChart) this.iChart.destroy();
  }

  setBreakdownMode(mode: 'type' | 'priority') {
      this.breakdownMode = mode;
      this.updateBreakdownChart();
  }

  // Range Slider Integration
  onTimeRangeChange(range: SliderRange) {
      if (!this.userHasInteractedWithSlider) {
          this.userHasInteractedWithSlider = true;
      }

      const year = this.selectedYear();
      
      // Calculate start and end months (1-12)
      const startMonth = range.min;
      const endMonth = range.max;

      // Find records that match both the selected YEAR and Month Range
      const availableData = this.monthsForYear(); 
      
      const matchedMonths = availableData
          .filter(d => {
              // Parse month from "YYYY-MM" format
              const parts = d.month.split('-');
              let mNum = -1;
              
              if (parts.length >= 2) {
                  // YYYY-MM
                  mNum = parseInt(parts[1], 10);
              } else {
                  // Fallback: "MonthName YYYY" or just "MonthName"
                  const mName = d.month.split(' ')[0];
                  const idx = ['January', 'February', 'March', 'April', 'May', 'June', 
                               'July', 'August', 'September', 'October', 'November', 'December']
                               .indexOf(mName);
                  if (idx !== -1) mNum = idx + 1;
              }
              
              return mNum >= startMonth && mNum <= endMonth;
          })
          .map(d => d.month);

      this.selectedMonths.set(matchedMonths);
  }

  private initCharts() {
      const data = this.history();
      const isDark = this.themeService.isDark();
      const textColor = isDark ? '#e2e8f0' : '#1e293b'; 
      const gridColor = isDark ? '#334155' : '#e2e8f0';
      const themeMode = isDark ? 'dark' : 'light';

      // Common Styling
      const commonGrid = {
          borderColor: gridColor,
          strokeDashArray: 4,
      };
      
      // 1. Savings Growth Area Chart
      const savingsOptions = {
          series: [{
              name: 'Total Savings',
              data: data.map(d => d.savingsTotalAfterTransfer)
          }],
          chart: {
              type: 'area',
              height: 350,
              fontFamily: 'Inter, sans-serif',
              toolbar: { show: false },
              zoom: { enabled: false },
              foreColor: textColor
          },
          dataLabels: { enabled: false },
          stroke: { curve: 'smooth', width: 3 },
          xaxis: {
              categories: data.map(d => d.month),
              axisBorder: { show: false },
              axisTicks: { show: false }
          },
          grid: commonGrid,
          colors: ['#8b5cf6'],
          fill: {
              type: 'gradient',
              gradient: {
                  shadeIntensity: 1,
                  opacityFrom: 0.6,
                  opacityTo: 0.1,
                  stops: [0, 100]
              }
          },
          tooltip: {
              theme: themeMode,
              y: { formatter: (val: number) => '$' + val.toLocaleString() }
          },
          markers: { size: 4, colors: ['#fff'], strokeColors: '#8b5cf6', strokeWidth: 2, hover: { size: 6 } }
      };
      
      this.sChart = new ApexCharts(this.savingsChartEl.nativeElement, savingsOptions);
      this.sChart.render();

      // 2. Income vs Expenses Bar Chart
      const expenseOptions = {
          series: [{
              name: 'Income',
              data: data.map(d => d.income)
          }, {
              name: 'Expenses',
              data: data.map(d => d.expenses)
          },
          {
            name: 'Direct Additions',
            data: data.map(d => d.manualAdded || 0)
          },
          {
            name: 'Budget Savings',
            data: data.map(d => d.transferredToSavings)
          }],
          chart: {
              type: 'bar',
              height: 350,
              fontFamily: 'Inter, sans-serif',
              toolbar: { show: false },
              foreColor: textColor
          },
          plotOptions: {
              bar: {
                  horizontal: false,
                  columnWidth: '60%',
                  borderRadius: 4,
                  dataLabels: { position: 'top' }
              },
          },
          dataLabels: { enabled: false },
          stroke: { show: true, width: 2, colors: ['transparent'] },
          xaxis: {
              categories: data.map(d => d.month),
              axisBorder: { show: false },
              axisTicks: { show: false }
          },
          grid: commonGrid,
          colors: [
            '#10b981', // Income (Green)
            '#ef4444', // Expenses (Red)
            '#f59e0b', // Direct Additions (Amber)
            function({ value }: { value: number }) {
                return value < 0 ? '#1e293b' : '#8b5cf6'; // Dark Slate (deficit) vs Purple (saved)
            }
          ],
          fill: { opacity: 1 },
          tooltip: {
              theme: themeMode,
              y: { formatter: (val: number) => '$' + val.toLocaleString() }
          },
          legend: { position: 'top', horizontalAlign: 'right' }

      };

      this.eChart = new ApexCharts(this.expensesChartEl.nativeElement, expenseOptions);
      this.eChart.render();
  }

  private updateCharts(data: MonthlyRecord[]) {
      if (!this.sChart || !this.eChart) return;
      
      this.sChart.updateSeries([{
          data: data.map(d => d.savingsTotalAfterTransfer)
      }]);
      
      this.sChart.updateOptions({
          xaxis: { categories: data.map(d => d.month) }
      });

      this.eChart.updateSeries([{
          data: data.map(d => d.income)
      }, {
          data: data.map(d => d.expenses)
      }, {
          data: data.map(d => d.manualAdded || 0)
      }, {
          data: data.map(d => d.transferredToSavings)
      }]);
      
      this.eChart.updateOptions({
          xaxis: { categories: data.map(d => d.month) }
      });
  }

  private initBreakdownChart() {
      const isDark = this.themeService.isDark();
      const textColor = isDark ? '#e2e8f0' : '#1e293b';
      const themeMode = isDark ? 'dark' : 'light';

      const options = {
          series: [],
          title: { 
            text: 'Monthly Spending Breakdown',
            style: { fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, color: textColor } 
          },
          chart: {
              type: 'bar',
              height: 350,
              stacked: true,
              toolbar: { show: false },
              fontFamily: 'Inter, sans-serif',
              animations: { enabled: true },
              foreColor: textColor
          },
          plotOptions: {
            bar: {
              horizontal: true,
              borderRadius: 4,
              dataLabels: {
                total: {
                  enabled: true,
                  formatter: function (val: number) {
                    return '$' + val.toLocaleString();
                  },
                  style: { fontWeight: 700, color: textColor }
                }
              }
            },
          },
          colors: ['#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'], // Red, Blue, Purple, Amber, Green
          stroke: { width: 1, colors: ['#fff'] },
          xaxis: {
              categories: [],
              labels: {
                  formatter: function (val: number) {
                      return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
                  }
              },
              axisBorder: { show: false },
              axisTicks: { show: false }
          },
          grid: {
            borderColor: isDark ? '#334155' : '#f1f5f9',
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } }
          },
          fill: { opacity: 1 },
          legend: { position: 'top', horizontalAlign: 'right' },
          tooltip: {
            theme: themeMode,
            y: { formatter: (val: number) => '$' + val.toLocaleString() }
          }
      };

      if (this.breakdownChartEl) {
        this.bChart = new ApexCharts(this.breakdownChartEl.nativeElement, options);
        this.bChart.render();
      }
  }

  private updateBreakdownChart() {
    if (!this.bChart) return;
    
    // Get detailed history which has the full expense list
    const data = this.detailedHistory();
    const categories = data.length > 0 ? data.map(d => d.month) : this.history().map(d => d.month);
    
    // If detailed history is empty (e.g. migration issue or old data format), 
    // chart will be empty.
    
    let series: any[] = [];
    if (!data || data.length === 0) {
        // Fallback or empty state
        this.bChart.updateSeries([]);
        return;
    }

    if (this.breakdownMode === 'type') {
        // Aggregate by Type: Fixed, Variable, Savings
        const types = ['Fixed', 'Variable', 'Savings'] as const;
        series = types.map(type => {
            return {
                name: type,
                data: data.map(record => {
                    return (record.expenses || [])
                        .filter(e => e.type === type)
                        .reduce((sum, e) => sum + (e.amount || 0), 0);
                })
            };
        });
    } else {
        // Aggregate by Priority: Must Have, Need, Want, Emergency, Gift
        const priorities = ['Must Have', 'Need', 'Want', 'Emergency', 'Gift'] as const;
        series = priorities.map(p => {
            return {
                name: p,
                data: data.map(record => {
                    return (record.expenses || [])
                        .filter(e => e.priority === p)
                        .reduce((sum, e) => sum + (e.amount || 0), 0);
                })
            };
        });
    }

    this.bChart.updateOptions({
        xaxis: { categories: categories }
    });

    this.bChart.updateSeries(series);
  }

  private initItemChart() {
      const isDark = this.themeService.isDark();
      const textColor = isDark ? '#e2e8f0' : '#1e293b';
      const themeMode = isDark ? 'dark' : 'light';

      const options = {
          series: [],
          title: { 
            text: 'Item Level Breakdown (Treemap)',
            style: { fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 600, color: textColor } 
          },
          chart: {
              type: 'treemap',
              height: 400,
              fontFamily: 'Inter, sans-serif',
              toolbar: { show: false },
              animations: { enabled: true },
              foreColor: textColor
          },
          // Extended palette for distributed colors
          colors: [
              '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', 
              '#ef4444', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
              '#a855f7', '#db2777', '#06b6d4', '#eab308', '#2563eb'
          ],
          plotOptions: {
              treemap: {
                  distributed: true,
                  enableShades: true,
                  shadeIntensity: 0.5
              }
          },
          dataLabels: {
              enabled: true,
              style: {
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 'bold',
                  colors: ['#fff']
              },
              formatter: function(text: string, op: any) {
                  return [text, '$' + op.value.toLocaleString()];
              },
              offsetY: -4
          },
          tooltip: {
            theme: themeMode,
            y: { formatter: (val: number) => '$' + val.toLocaleString() }
          }
      };

      if (this.itemChartEl) {
        this.iChart = new ApexCharts(this.itemChartEl.nativeElement, options);
        this.iChart.render();
        // Initial update if months selected
        if(this.selectedMonths().length > 0) {
            this.updateItemChart();
        }
      }
  }

  private updateItemChart() {
    if (!this.iChart) return;

    const isDark = this.themeService.isDark();
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const themeMode = isDark ? 'dark' : 'light';

    // Update title color dynamically on data change (hack since chart.updateOptions might reset)
    this.iChart.updateOptions({
        chart: { foreColor: textColor },
        tooltip: { theme: themeMode }
    });

    const data = this.detailedHistory();
    const selected = this.selectedMonths();
    const typeFilter = this.filterType();
    const priorityFilter = this.filterPriority();

    if (selected.length === 0) {
        this.iChart.updateSeries([{ data: [] }]);
        return;
    }

    // 1. Get expenses from selected months
    const relevantRecords = data.filter(d => selected.includes(d.month));
    let allExpenses: ExpenseItem[] = [];
    relevantRecords.forEach(r => {
        if(r.expenses) allExpenses = [...allExpenses, ...r.expenses];
    });

    // 2. Global Filters
    if (typeFilter.length > 0) {
        allExpenses = allExpenses.filter(e => typeFilter.includes(e.type));
    } else {
        allExpenses = []; // No types selected
    }
    
    if (priorityFilter.length > 0) {
        allExpenses = allExpenses.filter(e => priorityFilter.includes(e.priority));
    } else {
        allExpenses = []; // No priorities selected
    }

    // 3. Group Strategy: Flatten all items into one list for distributed colors
    const combinedItems = allExpenses.reduce((acc, curr) => {
        const key = curr.name;
        // Group logic: sum amounts if name matches
        const existing = acc.find(x => x.x === key);
        if (existing) {
            existing.y += curr.amount; // update sum
        } else {
            acc.push({ x: key, y: curr.amount }); // new item
        }
        return acc;
    }, [] as { x: string, y: number }[]);
    
    // Sort descending by value (Standard Treemap logic)
    combinedItems.sort((a,b) => b.y - a.y);
    
    // Update Chart
    this.iChart.updateSeries([{
        name: 'All Items',
        data: combinedItems
    }]);
  }
}

