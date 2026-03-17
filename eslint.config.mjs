import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const generated = await generateEslintConfig({
	enableTypescript: true,
})

export default [
	...generated,
	{
		files: ['**/*.cjs'],
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},
]
