module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    // Development-specific relaxed rules
    'no-console': 'off',
    'no-debugger': 'off',
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/jsx-uses-vars': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-trailing-spaces': 'warn',
    'semi': ['warn', 'always'],
    'quotes': ['warn', 'single'],
    'indent': ['warn', 2],
    'comma-dangle': ['warn', 'always-multiline'],
    'no-multiple-empty-lines': ['warn', { 'max': 1 }]
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}; 