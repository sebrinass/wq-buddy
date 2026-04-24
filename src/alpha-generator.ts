import { SimulationData, SimulationSettings } from './types.js';

export class AlphaGenerator {
  private defaultSettings: SimulationSettings;

  constructor(defaultSettings: SimulationSettings) {
    this.defaultSettings = defaultSettings;
  }

  generateSingleAlpha(expression: string, settings?: Partial<SimulationSettings>): SimulationData {
    const simSettings = { ...this.defaultSettings, ...settings };
    return {
      type: 'REGULAR',
      settings: simSettings,
      regular: expression
    };
  }

  generateFromTemplate(template: string, fields: string[], replacements?: Record<string, any[]>): SimulationData[] {
    const alphas: SimulationData[] = [];

    if (!replacements) {
      for (const field of fields) {
        const expression = template.replace(/\{field\}/g, field);
        alphas.push(this.generateSingleAlpha(expression));
      }
      return alphas;
    }

    const keys = Object.keys(replacements);
    const values = Object.values(replacements);
    const combinations = this.cartesianProduct(values);

    for (const field of fields) {
      for (const combo of combinations) {
        let expression = template;
        const replacementMap: Record<string, any> = {};
        keys.forEach((key, i) => {
          replacementMap[key] = combo[i];
        });
        replacementMap['field'] = field;

        for (const [key, val] of Object.entries(replacementMap)) {
          expression = expression.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        }

        alphas.push(this.generateSingleAlpha(expression));
      }
    }

    return alphas;
  }

  generateGroupTsCombo(
    fields: string[],
    groupOps: string[] = ['group_rank', 'group_neutralize'],
    tsOps: string[] = ['ts_delta', 'ts_zscore'],
    days: number[] = [63, 126],
    groups: string[] = ['market', 'sector', 'industry']
  ): SimulationData[] {
    const alphas: SimulationData[] = [];

    for (const field of fields) {
      for (const groupOp of groupOps) {
        for (const tsOp of tsOps) {
          for (const day of days) {
            for (const group of groups) {
              const expression = `${groupOp}(${tsOp}(${field}, ${day}), ${group})`;
              alphas.push(this.generateSingleAlpha(expression));
            }
          }
        }
      }
    }

    return alphas;
  }

  countCombinations(fieldsCount: number, replacements?: Record<string, any[]>): number {
    if (!replacements) {
      return fieldsCount;
    }

    const values = Object.values(replacements);
    const comboCount = values.reduce((acc, val) => acc * val.length, 1);
    return fieldsCount * comboCount;
  }

  private cartesianProduct(arrays: any[][]): any[][] {
    return arrays.reduce((acc, curr) => {
      return acc.flatMap(a => curr.map(b => [...a, b]));
    }, [[]] as any[][]);
  }
}
