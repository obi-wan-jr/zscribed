import { updateNavigation } from './common.js';

// Update navigation after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, updating navigation...');
    updateNavigation();
});

// Also try immediately in case DOM is already loaded
if (document.readyState === 'loading') {
    console.log('DOM still loading, will update when ready...');
} else {
    console.log('DOM already loaded, updating navigation immediately...');
    updateNavigation();
}
