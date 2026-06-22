/**
 * 化学元素数据库
 * 包含全部118个化学元素的基本属性数据
 *
 * 数据来源：
 * - 共价半径: Cordero et al. 2008, Dalton Trans. pp 2832-2838
 * - 范德华半径: Alvarez 2013, Dalton Trans. 42 pp 8617-8636; Bondi 1964, J. Phys. Chem. 68 pp 441-451
 * - 原子量: IUPAC 2021 标准原子量
 * - CPK颜色: 标准分子可视化配色方案
 */

export interface ElementData {
  symbol: string;
  name: string;
  nameEn: string;
  atomicNumber: number;
  atomicMass: number;
  color: string;
  covalentRadius: number;
  vdwRadius: number;
  valences: number[];
  group: number;
}

export const ELEMENTS: ElementData[] = [
  // ===== 第1周期 =====
  { symbol: 'H', name: '氢', nameEn: 'Hydrogen', atomicNumber: 1, atomicMass: 1.008, color: '#FFFFFF', covalentRadius: 0.31, vdwRadius: 1.20, valences: [1], group: 1 },
  { symbol: 'He', name: '氦', nameEn: 'Helium', atomicNumber: 2, atomicMass: 4.0026, color: '#B3E3F5', covalentRadius: 0.28, vdwRadius: 1.40, valences: [0], group: 18 },

  // ===== 第2周期 =====
  { symbol: 'Li', name: '锂', nameEn: 'Lithium', atomicNumber: 3, atomicMass: 6.941, color: '#AB5CF2', covalentRadius: 1.28, vdwRadius: 1.82, valences: [1], group: 1 },
  { symbol: 'Be', name: '铍', nameEn: 'Beryllium', atomicNumber: 4, atomicMass: 9.0122, color: '#8AFF00', covalentRadius: 0.96, vdwRadius: 1.53, valences: [2], group: 2 },
  { symbol: 'B', name: '硼', nameEn: 'Boron', atomicNumber: 5, atomicMass: 10.81, color: '#FFA500', covalentRadius: 0.84, vdwRadius: 1.92, valences: [3], group: 13 },
  { symbol: 'C', name: '碳', nameEn: 'Carbon', atomicNumber: 6, atomicMass: 12.011, color: '#909090', covalentRadius: 0.76, vdwRadius: 1.70, valences: [4], group: 14 },
  { symbol: 'N', name: '氮', nameEn: 'Nitrogen', atomicNumber: 7, atomicMass: 14.007, color: '#3050F8', covalentRadius: 0.71, vdwRadius: 1.55, valences: [3, 5], group: 15 },
  { symbol: 'O', name: '氧', nameEn: 'Oxygen', atomicNumber: 8, atomicMass: 15.999, color: '#FF0D0D', covalentRadius: 0.66, vdwRadius: 1.52, valences: [2], group: 16 },
  { symbol: 'F', name: '氟', nameEn: 'Fluorine', atomicNumber: 9, atomicMass: 18.998, color: '#90E050', covalentRadius: 0.57, vdwRadius: 1.47, valences: [1], group: 17 },
  { symbol: 'Ne', name: '氖', nameEn: 'Neon', atomicNumber: 10, atomicMass: 20.180, color: '#B3E3F5', covalentRadius: 0.58, vdwRadius: 1.54, valences: [0], group: 18 },

  // ===== 第3周期 =====
  { symbol: 'Na', name: '钠', nameEn: 'Sodium', atomicNumber: 11, atomicMass: 22.990, color: '#AB5CF2', covalentRadius: 1.66, vdwRadius: 2.27, valences: [1], group: 1 },
  { symbol: 'Mg', name: '镁', nameEn: 'Magnesium', atomicNumber: 12, atomicMass: 24.305, color: '#8AFF00', covalentRadius: 1.41, vdwRadius: 1.73, valences: [2], group: 2 },
  { symbol: 'Al', name: '铝', nameEn: 'Aluminium', atomicNumber: 13, atomicMass: 26.982, color: '#BFA6A6', covalentRadius: 1.21, vdwRadius: 2.04, valences: [3], group: 13 },
  { symbol: 'Si', name: '硅', nameEn: 'Silicon', atomicNumber: 14, atomicMass: 28.086, color: '#FFA500', covalentRadius: 1.11, vdwRadius: 2.10, valences: [4], group: 14 },
  { symbol: 'P', name: '磷', nameEn: 'Phosphorus', atomicNumber: 15, atomicMass: 30.974, color: '#FF8000', covalentRadius: 1.07, vdwRadius: 1.80, valences: [3, 5], group: 15 },
  { symbol: 'S', name: '硫', nameEn: 'Sulfur', atomicNumber: 16, atomicMass: 32.065, color: '#FFFF30', covalentRadius: 1.05, vdwRadius: 1.80, valences: [2, 4, 6], group: 16 },
  { symbol: 'Cl', name: '氯', nameEn: 'Chlorine', atomicNumber: 17, atomicMass: 35.453, color: '#1FF01F', covalentRadius: 1.02, vdwRadius: 1.75, valences: [1, 3, 5, 7], group: 17 },
  { symbol: 'Ar', name: '氩', nameEn: 'Argon', atomicNumber: 18, atomicMass: 39.948, color: '#B3E3F5', covalentRadius: 1.06, vdwRadius: 1.88, valences: [0], group: 18 },

  // ===== 第4周期 =====
  { symbol: 'K', name: '钾', nameEn: 'Potassium', atomicNumber: 19, atomicMass: 39.098, color: '#AB5CF2', covalentRadius: 2.03, vdwRadius: 2.75, valences: [1], group: 1 },
  { symbol: 'Ca', name: '钙', nameEn: 'Calcium', atomicNumber: 20, atomicMass: 40.078, color: '#8AFF00', covalentRadius: 1.76, vdwRadius: 2.31, valences: [2], group: 2 },
  { symbol: 'Sc', name: '钪', nameEn: 'Scandium', atomicNumber: 21, atomicMass: 44.956, color: '#6B8E23', covalentRadius: 1.70, vdwRadius: 2.15, valences: [3], group: 3 },
  { symbol: 'Ti', name: '钛', nameEn: 'Titanium', atomicNumber: 22, atomicMass: 47.867, color: '#6B8E23', covalentRadius: 1.60, vdwRadius: 2.11, valences: [2, 3, 4], group: 4 },
  { symbol: 'V', name: '钒', nameEn: 'Vanadium', atomicNumber: 23, atomicMass: 50.942, color: '#6B8E23', covalentRadius: 1.53, vdwRadius: 2.07, valences: [2, 3, 4, 5], group: 5 },
  { symbol: 'Cr', name: '铬', nameEn: 'Chromium', atomicNumber: 24, atomicMass: 51.996, color: '#6B8E23', covalentRadius: 1.39, vdwRadius: 2.06, valences: [2, 3, 6], group: 6 },
  { symbol: 'Mn', name: '锰', nameEn: 'Manganese', atomicNumber: 25, atomicMass: 54.938, color: '#9C7AC7', covalentRadius: 1.39, vdwRadius: 2.05, valences: [2, 3, 4, 7], group: 7 },
  { symbol: 'Fe', name: '铁', nameEn: 'Iron', atomicNumber: 26, atomicMass: 55.845, color: '#E06633', covalentRadius: 1.32, vdwRadius: 2.04, valences: [2, 3], group: 8 },
  { symbol: 'Co', name: '钴', nameEn: 'Cobalt', atomicNumber: 27, atomicMass: 58.933, color: '#F090A0', covalentRadius: 1.26, vdwRadius: 2.00, valences: [2, 3], group: 9 },
  { symbol: 'Ni', name: '镍', nameEn: 'Nickel', atomicNumber: 28, atomicMass: 58.693, color: '#50D050', covalentRadius: 1.24, vdwRadius: 1.97, valences: [2, 3], group: 10 },
  { symbol: 'Cu', name: '铜', nameEn: 'Copper', atomicNumber: 29, atomicMass: 63.546, color: '#C88033', covalentRadius: 1.32, vdwRadius: 1.96, valences: [1, 2], group: 11 },
  { symbol: 'Zn', name: '锌', nameEn: 'Zinc', atomicNumber: 30, atomicMass: 65.38, color: '#7D80B0', covalentRadius: 1.22, vdwRadius: 2.01, valences: [2], group: 12 },
  { symbol: 'Ga', name: '镓', nameEn: 'Gallium', atomicNumber: 31, atomicMass: 69.723, color: '#B87333', covalentRadius: 1.22, vdwRadius: 1.87, valences: [3], group: 13 },
  { symbol: 'Ge', name: '锗', nameEn: 'Germanium', atomicNumber: 32, atomicMass: 72.630, color: '#FFA500', covalentRadius: 1.20, vdwRadius: 2.11, valences: [4], group: 14 },
  { symbol: 'As', name: '砷', nameEn: 'Arsenic', atomicNumber: 33, atomicMass: 74.922, color: '#FFA500', covalentRadius: 1.19, vdwRadius: 1.85, valences: [3, 5], group: 15 },
  { symbol: 'Se', name: '硒', nameEn: 'Selenium', atomicNumber: 34, atomicMass: 78.971, color: '#FFA100', covalentRadius: 1.20, vdwRadius: 1.90, valences: [2, 4, 6], group: 16 },
  { symbol: 'Br', name: '溴', nameEn: 'Bromine', atomicNumber: 35, atomicMass: 79.904, color: '#603010', covalentRadius: 1.20, vdwRadius: 1.85, valences: [1, 3, 5], group: 17 },
  { symbol: 'Kr', name: '氪', nameEn: 'Krypton', atomicNumber: 36, atomicMass: 83.798, color: '#B3E3F5', covalentRadius: 1.16, vdwRadius: 2.02, valences: [0], group: 18 },

  // ===== 第5周期 =====
  { symbol: 'Rb', name: '铷', nameEn: 'Rubidium', atomicNumber: 37, atomicMass: 85.468, color: '#AB5CF2', covalentRadius: 2.20, vdwRadius: 3.03, valences: [1], group: 1 },
  { symbol: 'Sr', name: '锶', nameEn: 'Strontium', atomicNumber: 38, atomicMass: 87.62, color: '#8AFF00', covalentRadius: 1.95, vdwRadius: 2.49, valences: [2], group: 2 },
  { symbol: 'Y', name: '钇', nameEn: 'Yttrium', atomicNumber: 39, atomicMass: 88.906, color: '#6B8E23', covalentRadius: 1.90, vdwRadius: 2.32, valences: [3], group: 3 },
  { symbol: 'Zr', name: '锆', nameEn: 'Zirconium', atomicNumber: 40, atomicMass: 91.224, color: '#6B8E23', covalentRadius: 1.75, vdwRadius: 2.23, valences: [4], group: 4 },
  { symbol: 'Nb', name: '铌', nameEn: 'Niobium', atomicNumber: 41, atomicMass: 92.906, color: '#6B8E23', covalentRadius: 1.64, vdwRadius: 2.18, valences: [3, 5], group: 5 },
  { symbol: 'Mo', name: '钼', nameEn: 'Molybdenum', atomicNumber: 42, atomicMass: 95.95, color: '#6B8E23', covalentRadius: 1.54, vdwRadius: 2.17, valences: [2, 4, 6], group: 6 },
  { symbol: 'Tc', name: '锝', nameEn: 'Technetium', atomicNumber: 43, atomicMass: 98.0, color: '#6B8E23', covalentRadius: 1.47, vdwRadius: 2.16, valences: [4, 7], group: 7 },
  { symbol: 'Ru', name: '钌', nameEn: 'Ruthenium', atomicNumber: 44, atomicMass: 101.07, color: '#6B8E23', covalentRadius: 1.46, vdwRadius: 2.13, valences: [3, 4], group: 8 },
  { symbol: 'Rh', name: '铑', nameEn: 'Rhodium', atomicNumber: 45, atomicMass: 102.91, color: '#6B8E23', covalentRadius: 1.42, vdwRadius: 2.10, valences: [3], group: 9 },
  { symbol: 'Pd', name: '钯', nameEn: 'Palladium', atomicNumber: 46, atomicMass: 106.42, color: '#006985', covalentRadius: 1.39, vdwRadius: 2.10, valences: [2, 4], group: 10 },
  { symbol: 'Ag', name: '银', nameEn: 'Silver', atomicNumber: 47, atomicMass: 107.87, color: '#C0C0C0', covalentRadius: 1.45, vdwRadius: 2.11, valences: [1], group: 11 },
  { symbol: 'Cd', name: '镉', nameEn: 'Cadmium', atomicNumber: 48, atomicMass: 112.41, color: '#FFD98F', covalentRadius: 1.44, vdwRadius: 2.18, valences: [2], group: 12 },
  { symbol: 'In', name: '铟', nameEn: 'Indium', atomicNumber: 49, atomicMass: 114.82, color: '#B87333', covalentRadius: 1.42, vdwRadius: 1.93, valences: [3], group: 13 },
  { symbol: 'Sn', name: '锡', nameEn: 'Tin', atomicNumber: 50, atomicMass: 118.71, color: '#B87333', covalentRadius: 1.39, vdwRadius: 2.17, valences: [2, 4], group: 14 },
  { symbol: 'Sb', name: '锑', nameEn: 'Antimony', atomicNumber: 51, atomicMass: 121.76, color: '#FFA500', covalentRadius: 1.39, vdwRadius: 2.06, valences: [3, 5], group: 15 },
  { symbol: 'Te', name: '碲', nameEn: 'Tellurium', atomicNumber: 52, atomicMass: 127.60, color: '#FFA500', covalentRadius: 1.38, vdwRadius: 2.06, valences: [2, 4, 6], group: 16 },
  { symbol: 'I', name: '碘', nameEn: 'Iodine', atomicNumber: 53, atomicMass: 126.90, color: '#940094', covalentRadius: 1.39, vdwRadius: 1.98, valences: [1, 3, 5, 7], group: 17 },
  { symbol: 'Xe', name: '氙', nameEn: 'Xenon', atomicNumber: 54, atomicMass: 131.29, color: '#B3E3F5', covalentRadius: 1.40, vdwRadius: 2.16, valences: [0, 2, 4, 6], group: 18 },

  // ===== 第6周期 =====
  { symbol: 'Cs', name: '铯', nameEn: 'Caesium', atomicNumber: 55, atomicMass: 132.91, color: '#AB5CF2', covalentRadius: 2.44, vdwRadius: 3.43, valences: [1], group: 1 },
  { symbol: 'Ba', name: '钡', nameEn: 'Barium', atomicNumber: 56, atomicMass: 137.33, color: '#8AFF00', covalentRadius: 2.15, vdwRadius: 2.68, valences: [2], group: 2 },
  // 镧系 (57-71)
  { symbol: 'La', name: '镧', nameEn: 'Lanthanum', atomicNumber: 57, atomicMass: 138.91, color: '#70D4FF', covalentRadius: 2.07, vdwRadius: 2.43, valences: [3], group: 0 },
  { symbol: 'Ce', name: '铈', nameEn: 'Cerium', atomicNumber: 58, atomicMass: 140.12, color: '#70D4FF', covalentRadius: 2.04, vdwRadius: 2.42, valences: [3, 4], group: 0 },
  { symbol: 'Pr', name: '镨', nameEn: 'Praseodymium', atomicNumber: 59, atomicMass: 140.91, color: '#70D4FF', covalentRadius: 2.03, vdwRadius: 2.40, valences: [3], group: 0 },
  { symbol: 'Nd', name: '钕', nameEn: 'Neodymium', atomicNumber: 60, atomicMass: 144.24, color: '#70D4FF', covalentRadius: 2.01, vdwRadius: 2.39, valences: [3], group: 0 },
  { symbol: 'Pm', name: '钷', nameEn: 'Promethium', atomicNumber: 61, atomicMass: 145.0, color: '#70D4FF', covalentRadius: 1.99, vdwRadius: 2.38, valences: [3], group: 0 },
  { symbol: 'Sm', name: '钐', nameEn: 'Samarium', atomicNumber: 62, atomicMass: 150.36, color: '#70D4FF', covalentRadius: 1.98, vdwRadius: 2.36, valences: [2, 3], group: 0 },
  { symbol: 'Eu', name: '铕', nameEn: 'Europium', atomicNumber: 63, atomicMass: 151.96, color: '#70D4FF', covalentRadius: 1.98, vdwRadius: 2.35, valences: [2, 3], group: 0 },
  { symbol: 'Gd', name: '钆', nameEn: 'Gadolinium', atomicNumber: 64, atomicMass: 157.25, color: '#70D4FF', covalentRadius: 1.96, vdwRadius: 2.34, valences: [3], group: 0 },
  { symbol: 'Tb', name: '铽', nameEn: 'Terbium', atomicNumber: 65, atomicMass: 158.93, color: '#70D4FF', covalentRadius: 1.94, vdwRadius: 2.33, valences: [3, 4], group: 0 },
  { symbol: 'Dy', name: '镝', nameEn: 'Dysprosium', atomicNumber: 66, atomicMass: 162.50, color: '#70D4FF', covalentRadius: 1.92, vdwRadius: 2.31, valences: [3], group: 0 },
  { symbol: 'Ho', name: '钬', nameEn: 'Holmium', atomicNumber: 67, atomicMass: 164.93, color: '#70D4FF', covalentRadius: 1.92, vdwRadius: 2.30, valences: [3], group: 0 },
  { symbol: 'Er', name: '铒', nameEn: 'Erbium', atomicNumber: 68, atomicMass: 167.26, color: '#70D4FF', covalentRadius: 1.89, vdwRadius: 2.29, valences: [3], group: 0 },
  { symbol: 'Tm', name: '铥', nameEn: 'Thulium', atomicNumber: 69, atomicMass: 168.93, color: '#70D4FF', covalentRadius: 1.90, vdwRadius: 2.27, valences: [3], group: 0 },
  { symbol: 'Yb', name: '镱', nameEn: 'Ytterbium', atomicNumber: 70, atomicMass: 173.05, color: '#70D4FF', covalentRadius: 1.87, vdwRadius: 2.26, valences: [2, 3], group: 0 },
  { symbol: 'Lu', name: '镥', nameEn: 'Lutetium', atomicNumber: 71, atomicMass: 174.97, color: '#70D4FF', covalentRadius: 1.87, vdwRadius: 2.24, valences: [3], group: 0 },
  // 第6周期续 (72-86)
  { symbol: 'Hf', name: '铪', nameEn: 'Hafnium', atomicNumber: 72, atomicMass: 178.49, color: '#6B8E23', covalentRadius: 1.75, vdwRadius: 2.23, valences: [4], group: 4 },
  { symbol: 'Ta', name: '钽', nameEn: 'Tantalum', atomicNumber: 73, atomicMass: 180.95, color: '#6B8E23', covalentRadius: 1.70, vdwRadius: 2.22, valences: [5], group: 5 },
  { symbol: 'W', name: '钨', nameEn: 'Tungsten', atomicNumber: 74, atomicMass: 183.84, color: '#6B8E23', covalentRadius: 1.62, vdwRadius: 2.18, valences: [4, 6], group: 6 },
  { symbol: 'Re', name: '铼', nameEn: 'Rhenium', atomicNumber: 75, atomicMass: 186.21, color: '#6B8E23', covalentRadius: 1.51, vdwRadius: 2.16, valences: [4, 7], group: 7 },
  { symbol: 'Os', name: '锇', nameEn: 'Osmium', atomicNumber: 76, atomicMass: 190.23, color: '#6B8E23', covalentRadius: 1.44, vdwRadius: 2.16, valences: [4, 6], group: 8 },
  { symbol: 'Ir', name: '铱', nameEn: 'Iridium', atomicNumber: 77, atomicMass: 192.22, color: '#6B8E23', covalentRadius: 1.41, vdwRadius: 2.13, valences: [3, 4], group: 9 },
  { symbol: 'Pt', name: '铂', nameEn: 'Platinum', atomicNumber: 78, atomicMass: 195.08, color: '#D0D0E0', covalentRadius: 1.36, vdwRadius: 2.13, valences: [2, 4], group: 10 },
  { symbol: 'Au', name: '金', nameEn: 'Gold', atomicNumber: 79, atomicMass: 196.97, color: '#FFD123', covalentRadius: 1.36, vdwRadius: 2.14, valences: [1, 3], group: 11 },
  { symbol: 'Hg', name: '汞', nameEn: 'Mercury', atomicNumber: 80, atomicMass: 200.59, color: '#B8B8D0', covalentRadius: 1.32, vdwRadius: 2.23, valences: [1, 2], group: 12 },
  { symbol: 'Tl', name: '铊', nameEn: 'Thallium', atomicNumber: 81, atomicMass: 204.38, color: '#B87333', covalentRadius: 1.45, vdwRadius: 1.96, valences: [1, 3], group: 13 },
  { symbol: 'Pb', name: '铅', nameEn: 'Lead', atomicNumber: 82, atomicMass: 207.2, color: '#B87333', covalentRadius: 1.46, vdwRadius: 2.02, valences: [2, 4], group: 14 },
  { symbol: 'Bi', name: '铋', nameEn: 'Bismuth', atomicNumber: 83, atomicMass: 208.98, color: '#B87333', covalentRadius: 1.48, vdwRadius: 2.07, valences: [3, 5], group: 15 },
  { symbol: 'Po', name: '钋', nameEn: 'Polonium', atomicNumber: 84, atomicMass: 209.0, color: '#B87333', covalentRadius: 1.40, vdwRadius: 1.97, valences: [2, 4], group: 16 },
  { symbol: 'At', name: '砹', nameEn: 'Astatine', atomicNumber: 85, atomicMass: 210.0, color: '#940094', covalentRadius: 1.50, vdwRadius: 2.02, valences: [1], group: 17 },
  { symbol: 'Rn', name: '氡', nameEn: 'Radon', atomicNumber: 86, atomicMass: 222.0, color: '#B3E3F5', covalentRadius: 1.50, vdwRadius: 2.20, valences: [0], group: 18 },

  // ===== 第7周期 =====
  { symbol: 'Fr', name: '钫', nameEn: 'Francium', atomicNumber: 87, atomicMass: 223.0, color: '#AB5CF2', covalentRadius: 2.60, vdwRadius: 3.48, valences: [1], group: 1 },
  { symbol: 'Ra', name: '镭', nameEn: 'Radium', atomicNumber: 88, atomicMass: 226.0, color: '#8AFF00', covalentRadius: 2.21, vdwRadius: 2.83, valences: [2], group: 2 },
  // 锕系 (89-103)
  { symbol: 'Ac', name: '锕', nameEn: 'Actinium', atomicNumber: 89, atomicMass: 227.0, color: '#8F8FFF', covalentRadius: 2.15, vdwRadius: 2.47, valences: [3], group: 0 },
  { symbol: 'Th', name: '钍', nameEn: 'Thorium', atomicNumber: 90, atomicMass: 232.04, color: '#8F8FFF', covalentRadius: 2.06, vdwRadius: 2.45, valences: [4], group: 0 },
  { symbol: 'Pa', name: '镤', nameEn: 'Protactinium', atomicNumber: 91, atomicMass: 231.04, color: '#8F8FFF', covalentRadius: 2.00, vdwRadius: 2.43, valences: [5], group: 0 },
  { symbol: 'U', name: '铀', nameEn: 'Uranium', atomicNumber: 92, atomicMass: 238.03, color: '#8F8FFF', covalentRadius: 1.96, vdwRadius: 2.41, valences: [4, 6], group: 0 },
  { symbol: 'Np', name: '镎', nameEn: 'Neptunium', atomicNumber: 93, atomicMass: 237.0, color: '#8F8FFF', covalentRadius: 1.90, vdwRadius: 2.39, valences: [4, 5, 6], group: 0 },
  { symbol: 'Pu', name: '钚', nameEn: 'Plutonium', atomicNumber: 94, atomicMass: 244.0, color: '#8F8FFF', covalentRadius: 1.87, vdwRadius: 2.43, valences: [3, 4, 5, 6], group: 0 },
  { symbol: 'Am', name: '镅', nameEn: 'Americium', atomicNumber: 95, atomicMass: 243.0, color: '#8F8FFF', covalentRadius: 1.80, vdwRadius: 2.44, valences: [3, 4, 5, 6], group: 0 },
  { symbol: 'Cm', name: '锔', nameEn: 'Curium', atomicNumber: 96, atomicMass: 247.0, color: '#8F8FFF', covalentRadius: 1.69, vdwRadius: 2.45, valences: [3], group: 0 },
  { symbol: 'Bk', name: '锫', nameEn: 'Berkelium', atomicNumber: 97, atomicMass: 247.0, color: '#8F8FFF', covalentRadius: 1.68, vdwRadius: 2.44, valences: [3, 4], group: 0 },
  { symbol: 'Cf', name: '锎', nameEn: 'Californium', atomicNumber: 98, atomicMass: 251.0, color: '#8F8FFF', covalentRadius: 1.68, vdwRadius: 2.42, valences: [3], group: 0 },
  { symbol: 'Es', name: '锿', nameEn: 'Einsteinium', atomicNumber: 99, atomicMass: 252.0, color: '#8F8FFF', covalentRadius: 1.65, vdwRadius: 2.41, valences: [3], group: 0 },
  { symbol: 'Fm', name: '镄', nameEn: 'Fermium', atomicNumber: 100, atomicMass: 257.0, color: '#8F8FFF', covalentRadius: 1.67, vdwRadius: 2.40, valences: [3], group: 0 },
  { symbol: 'Md', name: '钔', nameEn: 'Mendelevium', atomicNumber: 101, atomicMass: 258.0, color: '#8F8FFF', covalentRadius: 1.73, vdwRadius: 2.39, valences: [3], group: 0 },
  { symbol: 'No', name: '锘', nameEn: 'Nobelium', atomicNumber: 102, atomicMass: 259.0, color: '#8F8FFF', covalentRadius: 1.76, vdwRadius: 2.38, valences: [3], group: 0 },
  { symbol: 'Lr', name: '铹', nameEn: 'Lawrencium', atomicNumber: 103, atomicMass: 266.0, color: '#8F8FFF', covalentRadius: 1.61, vdwRadius: 2.37, valences: [3], group: 0 },
  // 第7周期续 (104-118)
  { symbol: 'Rf', name: '𬬻', nameEn: 'Rutherfordium', atomicNumber: 104, atomicMass: 267.0, color: '#6B8E23', covalentRadius: 1.57, vdwRadius: 2.30, valences: [4], group: 4 },
  { symbol: 'Db', name: '𬭊', nameEn: 'Dubnium', atomicNumber: 105, atomicMass: 268.0, color: '#6B8E23', covalentRadius: 1.49, vdwRadius: 2.28, valences: [5], group: 5 },
  { symbol: 'Sg', name: '𬭳', nameEn: 'Seaborgium', atomicNumber: 106, atomicMass: 269.0, color: '#6B8E23', covalentRadius: 1.43, vdwRadius: 2.26, valences: [6], group: 6 },
  { symbol: 'Bh', name: '𬭛', nameEn: 'Bohrium', atomicNumber: 107, atomicMass: 270.0, color: '#6B8E23', covalentRadius: 1.41, vdwRadius: 2.24, valences: [7], group: 7 },
  { symbol: 'Hs', name: '𬭶', nameEn: 'Hassium', atomicNumber: 108, atomicMass: 277.0, color: '#6B8E23', covalentRadius: 1.34, vdwRadius: 2.22, valences: [8], group: 8 },
  { symbol: 'Mt', name: '鿏', nameEn: 'Meitnerium', atomicNumber: 109, atomicMass: 278.0, color: '#6B8E23', covalentRadius: 1.29, vdwRadius: 2.20, valences: [0], group: 9 },
  { symbol: 'Ds', name: '𫟼', nameEn: 'Darmstadtium', atomicNumber: 110, atomicMass: 281.0, color: '#6B8E23', covalentRadius: 1.28, vdwRadius: 2.18, valences: [0], group: 10 },
  { symbol: 'Rg', name: '𬬭', nameEn: 'Roentgenium', atomicNumber: 111, atomicMass: 282.0, color: '#6B8E23', covalentRadius: 1.21, vdwRadius: 2.16, valences: [0], group: 11 },
  { symbol: 'Cn', name: '鿔', nameEn: 'Copernicium', atomicNumber: 112, atomicMass: 285.0, color: '#6B8E23', covalentRadius: 1.22, vdwRadius: 2.14, valences: [0], group: 12 },
  { symbol: 'Nh', name: '鿭', nameEn: 'Nihonium', atomicNumber: 113, atomicMass: 286.0, color: '#B87333', covalentRadius: 1.36, vdwRadius: 2.10, valences: [1], group: 13 },
  { symbol: 'Fl', name: '𫓧', nameEn: 'Flerovium', atomicNumber: 114, atomicMass: 289.0, color: '#B87333', covalentRadius: 1.43, vdwRadius: 2.08, valences: [2], group: 14 },
  { symbol: 'Mc', name: '镆', nameEn: 'Moscovium', atomicNumber: 115, atomicMass: 290.0, color: '#B87333', covalentRadius: 1.62, vdwRadius: 2.06, valences: [3], group: 15 },
  { symbol: 'Lv', name: '𫟷', nameEn: 'Livermorium', atomicNumber: 116, atomicMass: 293.0, color: '#B87333', covalentRadius: 1.75, vdwRadius: 2.04, valences: [2], group: 16 },
  { symbol: 'Ts', name: '鿬', nameEn: 'Tennessine', atomicNumber: 117, atomicMass: 294.0, color: '#940094', covalentRadius: 1.65, vdwRadius: 2.02, valences: [1], group: 17 },
  { symbol: 'Og', name: '鿫', nameEn: 'Oganesson', atomicNumber: 118, atomicMass: 294.0, color: '#B3E3F5', covalentRadius: 1.57, vdwRadius: 2.00, valences: [0], group: 18 },
];

// ===== 索引映射 =====

/** 按元素符号快速查找的 Map */
const ELEMENT_MAP = new Map<string, ElementData>(
  ELEMENTS.map(el => [el.symbol, el])
);

/** 所有有效元素符号的集合 */
export const ELEMENTS_SET: Set<string> = new Set(ELEMENTS.map(el => el.symbol));

/** 工具栏默认显示的10个元素 */
export const DEFAULT_TOOLBAR_ELEMENTS: string[] = ['C', 'H', 'O', 'N', 'F', 'Cl', 'Br', 'I', 'S', 'P'];

// ===== 辅助函数 =====

/**
 * 根据元素符号获取元素数据
 * @param symbol 元素符号（如 'H', 'He'）
 * @returns 元素数据，若未找到返回 undefined
 */
export function getElement(symbol: string): ElementData | undefined {
  return ELEMENT_MAP.get(symbol);
}

/**
 * 根据元素符号获取 CPK 颜色
 * @param symbol 元素符号
 * @returns 十六进制颜色值，默认 '#808080'
 */
export function getElementColor(symbol: string): string {
  return ELEMENT_MAP.get(symbol)?.color ?? '#808080';
}

/**
 * 根据元素符号获取共价半径
 * @param symbol 元素符号
 * @returns 共价半径（Å），默认 0.70
 */
export function getCovalentRadius(symbol: string): number {
  return ELEMENT_MAP.get(symbol)?.covalentRadius ?? 0.70;
}

/**
 * 根据元素符号获取范德华半径
 * @param symbol 元素符号
 * @returns 范德华半径（Å），默认 1.50
 */
export function getVdwRadius(symbol: string): number {
  return ELEMENT_MAP.get(symbol)?.vdwRadius ?? 1.50;
}

/**
 * 根据元素符号获取常见化合价数组
 * @param symbol 元素符号
 * @returns 化合价数组，默认 [4]
 */
export function getValences(symbol: string): number[] {
  return ELEMENT_MAP.get(symbol)?.valences ?? [4];
}

/**
 * 根据元素符号获取最常见的化合价（取 valences 数组中第一个非零值，或最后一个值）
 * @param symbol 元素符号
 * @returns 最常见化合价，默认 4
 */
export function getDefaultValence(symbol: string): number {
  const valences = ELEMENT_MAP.get(symbol)?.valences;
  if (!valences || valences.length === 0) return 4;
  // 对于有0化合价的元素（稀有气体），返回0；否则返回第一个非零化合价
  const nonZero = valences.filter(v => v !== 0);
  if (nonZero.length === 0) return 0;
  return nonZero[0];
}

/**
 * 检查给定符号是否为有效元素符号
 * @param symbol 待检查的符号
 * @returns 是否为有效元素
 */
export function isElement(symbol: string): boolean {
  return ELEMENTS_SET.has(symbol);
}
