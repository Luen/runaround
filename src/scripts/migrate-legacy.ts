import { migrateLegacy } from '../lib/server/migrate-legacy';

migrateLegacy()
	.then(() => {
		console.log('Legacy races migrated');
		process.exit(0);
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
