import { loadConfig } from './config.js';

const sessions = new Map(); // sessionId -> { user, expires }
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting
const loginAttempts = new Map(); // ip -> { count, resetTime }
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

export function generateSessionId() {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function createSession(user) {
	const sessionId = generateSessionId();
	const expires = Date.now() + SESSION_DURATION;
	sessions.set(sessionId, { user, expires });
	return sessionId;
}

export function getSession(sessionId) {
	const session = sessions.get(sessionId);
	if (!session) return null;
	if (Date.now() > session.expires) {
		sessions.delete(sessionId);
		return null;
	}
	return session;
}

export function deleteSession(sessionId) {
	sessions.delete(sessionId);
}

export function checkRateLimit(ip) {
	const now = Date.now();
	const attempts = loginAttempts.get(ip);
	
	if (!attempts || now > attempts.resetTime) {
		loginAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
		return true;
	}
	
	if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
		return false;
	}
	
	attempts.count++;
	return true;
}

export function requireAuth(req, res, next) {
	const sessionId = req.cookies?.sessionId;
	const session = getSession(sessionId);
	
	if (!session) {
		if (req.path.startsWith('/api/')) {
			return res.status(401).json({ error: 'Unauthorized' });
		}
		return res.redirect('/login.html');
	}
	
	req.user = session.user;
	next();
}

export function getAuthMiddleware() {
	return (req, res, next) => {
		const sessionId = req.cookies?.sessionId;
		const session = getSession(sessionId);
		req.user = session?.user || null;
		next();
	};
}

// Clean up expired sessions and rate limit data periodically
setInterval(() => {
	const now = Date.now();
	
	// Clean sessions
	for (const [sessionId, session] of sessions.entries()) {
		if (now > session.expires) {
			sessions.delete(sessionId);
		}
	}
	
	// Clean rate limit data
	for (const [ip, attempts] of loginAttempts.entries()) {
		if (now > attempts.resetTime) {
			loginAttempts.delete(ip);
		}
	}
}, 60 * 60 * 1000); // Every hour
