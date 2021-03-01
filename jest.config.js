module.exports = {
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js'],
  resetMocks: true,
  maxWorkers: 4,
  verbose: false,
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json'
    }
  }
};
