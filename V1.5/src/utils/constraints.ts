import { BOND_ANGLES } from '../types';

/**
 * 化学分子结构约束规则清单
 * 
 * 1. 基础骨架类型约束
 * 2. 键角约束
 */

// 键角约束的默认容差（度）
export const DEFAULT_ANGLE_TOLERANCE = 5;

/**
 * 基础骨架类型约束清单
 */
export const SKELETON_CONSTRAINT_TYPES = {
  /**
   * sp杂化 - 直线型结构
   * - 两个σ键，无孤对电子或有两个孤对电子
   * - 键角：180°
   * - 例子：乙炔 (C2H2)、二氧化碳 (CO2)
   */
  SP_HYBRIDIZATION: {
    type: 'sp' as const,
    description: 'sp杂化 - 直线型结构，键角180°',
  },
  
  /**
   * sp2杂化 - 平面三角形结构
   * - 三个σ键，一个π键
   * - 键角：约120°
   * - 例子：乙烯 (C2H4)、苯 (C6H6)、甲醛 (HCHO)
   */
  SP2_HYBRIDIZATION: {
    type: 'sp2' as const,
    description: 'sp2杂化 - 平面三角形结构，键角约120°',
  },
  
  /**
   * sp3杂化 - 四面体结构
   * - 四个σ键
   * - 键角：约109.5°
   * - 例子：甲烷 (CH4)、乙烷 (C2H6)、氨 (NH3)、水 (H2O)
   */
  SP3_HYBRIDIZATION: {
    type: 'sp3' as const,
    description: 'sp3杂化 - 四面体结构，键角约109.5°',
  },
  
  /**
   * 共线约束 - 三个或更多原子在同一直线上
   * - 例子：乙炔中的C-C-H
   */
  COLLINEAR: {
    type: 'collinear' as const,
    description: '共线约束 - 多个原子在同一直线上',
  },
  
  /**
   * 共面约束 - 四个或更多原子在同一平面上
   * - 例子：苯环、乙烯
   */
  COPLANAR: {
    type: 'coplanar' as const,
    description: '共面约束 - 多个原子在同一平面上',
  },
  
  /**
   * 刚性基团 - 整个基团作为一个整体移动
   * - 例子：苯环、甲基、羰基
   */
  RIGID_GROUP: {
    type: 'rigid' as const,
    description: '刚性基团 - 整个基团作为一个整体移动',
  },
};

/**
 * 键角约束清单
 */
export const BOND_ANGLE_CONSTRAINTS = {
  /**
   * sp杂化的键角约束
   */
  SP_ANGLE: {
    description: 'sp杂化键角',
    idealAngle: BOND_ANGLES.SP,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * sp2杂化的键角约束
   */
  SP2_ANGLE: {
    description: 'sp2杂化键角',
    idealAngle: BOND_ANGLES.SP2,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * sp3杂化的键角约束
   */
  SP3_ANGLE: {
    description: 'sp3杂化键角',
    idealAngle: BOND_ANGLES.SP3,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * 水分子的键角约束 (H-O-H)
   */
  WATER_ANGLE: {
    description: '水分子H-O-H键角',
    idealAngle: BOND_ANGLES.WATER,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * 氨分子的键角约束 (H-N-H)
   */
  AMMONIA_ANGLE: {
    description: '氨分子H-N-H键角',
    idealAngle: BOND_ANGLES.AMMONIA,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * 苯环的键角约束
   */
  BENZENE_ANGLE: {
    description: '苯环键角',
    idealAngle: BOND_ANGLES.BENZENE,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * 乙烯的键角约束
   */
  ETHYLENE_ANGLE: {
    description: '乙烯键角',
    idealAngle: BOND_ANGLES.ETHYLENE,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
  
  /**
   * 乙炔的键角约束
   */
  ACETYLENE_ANGLE: {
    description: '乙炔键角',
    idealAngle: BOND_ANGLES.ACETYLENE,
    tolerance: DEFAULT_ANGLE_TOLERANCE,
  },
};

/**
 * 常见官能团的约束规则
 */
export const FUNCTIONAL_GROUP_CONSTRAINTS = {
  /**
   * 苯环 - 刚性共面结构
   */
  BENZENE_RING: {
    type: 'coplanar' as const,
    description: '苯环 - 刚性共面六元环',
    atomCount: 6,
  },
  
  /**
   * 甲基 - sp3杂化
   */
  METHYL: {
    type: 'sp3' as const,
    description: '甲基 - sp3四面体结构',
    atomCount: 4, // 1个C + 3个H
  },
  
  /**
   * 羰基 - sp2杂化，共面
   */
  CARBONYL: {
    type: 'sp2' as const,
    description: '羰基 - sp2平面三角形结构',
    atomCount: 3, // C + O + 连接原子
  },
  
  /**
   * 双键 - sp2杂化，共面
   */
  DOUBLE_BOND: {
    type: 'sp2' as const,
    description: '双键 - sp2平面结构，不能绕键旋转',
    atomCount: 4, // 2个双键原子 + 各一个连接原子
  },
  
  /**
   * 三键 - sp杂化，共线
   */
  TRIPLE_BOND: {
    type: 'sp' as const,
    description: '三键 - sp直线型结构',
    atomCount: 4, // 2个三键原子 + 各一个连接原子
  },
};

/**
 * 获取完整的约束规则清单
 */
export function getConstraintRulesList() {
  return {
    skeletonTypes: Object.entries(SKELETON_CONSTRAINT_TYPES).map(([key, value]) => ({
      id: key,
      ...value,
    })),
    bondAngles: Object.entries(BOND_ANGLE_CONSTRAINTS).map(([key, value]) => ({
      id: key,
      ...value,
    })),
    functionalGroups: Object.entries(FUNCTIONAL_GROUP_CONSTRAINTS).map(([key, value]) => ({
      id: key,
      ...value,
    })),
  };
}

export default {
  SKELETON_CONSTRAINT_TYPES,
  BOND_ANGLE_CONSTRAINTS,
  FUNCTIONAL_GROUP_CONSTRAINTS,
  getConstraintRulesList,
  DEFAULT_ANGLE_TOLERANCE,
};
