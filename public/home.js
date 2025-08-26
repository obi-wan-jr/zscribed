import { updateNavigation, requireAuth } from './common.js';

// Check authentication and update navigation
requireAuth().then(isAuthenticated => {
	if (isAuthenticated) {
		updateNavigation();
	}
});
