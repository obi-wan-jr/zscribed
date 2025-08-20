module.exports = {
	apps: [
		{
			name: 'dscribe',
			script: 'server/index.js',
			instances: 1,
			exec_mode: 'fork',
			env: {
				PORT: 3005,
				NODE_ENV: 'production'
			}
		}
	]
};
