import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import {vi, describe,it,expect,beforeEach} from 'vitest';
import {AuthProvider} from './AuthContext';
import {useAuth} from './useAuth';

// replacing real firebase/auth module with fake one
vi.mock("firebase/auth", async(importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onAuthStateChanged: vi.fn(),
    };
});

// Mock the Firebase app module so refreshUser() reads a controllable auth.currentUser
// instead of a real Firebase Auth instance.
vi.mock("../services/firebase", () => ({
    auth: {
        currentUser: null,
    },
}));

import { onAuthStateChanged } from 'firebase/auth';
import { useState } from 'react';
import { auth } from '../services/firebase';

// small component that displays what useAuth() gives it, so we have something to check in rendered output.
function TestConsumer() {
    const {currentUser, loading} = useAuth();
    if (loading) return <p>Loading...</p>;
    if (!currentUser) return <p>No user</p>;
    return <p>User: {currentUser.email}</p>;
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.currentUser = null;
    });


    it('shows loading, then no user, when signed out', async () => {
        // simulate Firebase calling back immediately with null (logged out).
        onAuthStateChanged.mockImplementation((auth, callback) => {
            callback(null);
            return () => {}; // fake unsusbcribe function.
        });

        render(
            <AuthProvider>
                <TestConsumer/>
            </AuthProvider>
        );
        await waitFor(() => {
            expect(screen.getByText('No user')).toBeInTheDocument();
        });
    });

    it('shows the user when signed in', async () => {
        const fakeUser = {uid: 'sarah123', email: 'test@example.com'};

        onAuthStateChanged.mockImplementation((auth, callback) => {
            callback(fakeUser);
            return () => {};
        });

        render(
            <AuthProvider>
                <TestConsumer/>
            </AuthProvider>
        );
        await waitFor(() => {
            expect(screen.getByText('User: test@example.com')).toBeInTheDocument();
        });
    });

    it('shows loading state before Firebase responds', async () => {
        let triggerCallback;
        // capture the callback and hold onto it (we decide when Firebase responds).
        onAuthStateChanged.mockImplementation((auth, callback) => {
            triggerCallback = callback; // capturing callback.
            return () => {};
        });

        render(
            <AuthProvider>
                <TestConsumer/>
            </AuthProvider>
        );
        // useEffect has ran and called onAuthStateChanged, but we haven't invoked callback yet so loading is still true.
        expect(screen.getByText('Loading...')).toBeInTheDocument();

        // simulate Firebase responding with "no user"
        triggerCallback(null);

        // loading should flip to false and UI should update.
        await waitFor(() => {
            expect(screen.getByText('No user')).toBeInTheDocument();
        })
    })

    it("unsubscribes from onAuthStateChanged on unmount", () => {
        const unsubscribeMock = vi.fn();
        onAuthStateChanged.mockImplementation((auth, callback) => {
            callback(null);
            return unsubscribeMock;
        });

        const { unmount } = render(
            <AuthProvider>
                <TestConsumer/>
            </AuthProvider>
        );
        unmount();

        expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    })

});

// Shows emailVerified and calls refreshUser() from a button, the way a real page
// does, then displays the value refreshUser() returned.
function VerificationConsumer() {
    const { loading, emailVerified, refreshUser } = useAuth();
    const [result, setResult] = useState("none");
    if (loading) return <p>Loading...</p>;
    return (
        <>
            <p>Verified: {String(emailVerified)}</p>
            <p>Refresh result: {result}</p>
            <button onClick={async () => setResult(String(await refreshUser()))}>Refresh</button>
        </>
    );
}

function renderWithUser(user) {
    onAuthStateChanged.mockImplementation((_auth, callback) => {
        callback(user);
        return () => {};
    });
    return render(
        <AuthProvider>
            <VerificationConsumer/>
        </AuthProvider>
    );
}

// A stand-in Firebase User whose reload() flips emailVerified, the way Firebase
// does after the user clicks the link in the verification email.
function createUnverifiedUser({ verifiesOnReload }) {
    const user = {
        uid: 'sarah123',
        email: 'test@example.com',
        emailVerified: false,
        reload: vi.fn(async () => {
            if (verifiesOnReload) user.emailVerified = true;
        }),
        getIdToken: vi.fn().mockResolvedValue('fresh-token'),
    };
    return user;
}

describe('AuthContext email verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.currentUser = null;
    });

    it('exposes emailVerified from the signed-in user', async () => {
        renderWithUser({ uid: 'sarah123', email: 'test@example.com', emailVerified: true });
        expect(await screen.findByText('Verified: true')).toBeInTheDocument();
    });

    it('exposes emailVerified as null when signed out', async () => {
        renderWithUser(null);
        expect(await screen.findByText('Verified: null')).toBeInTheDocument();
    });

    it('refreshUser() reloads the user, forces a token refresh, returns true, and re-renders', async () => {
        const user = createUnverifiedUser({ verifiesOnReload: true });
        auth.currentUser = user;
        renderWithUser(user);
        expect(await screen.findByText('Verified: false')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        expect(await screen.findByText('Refresh result: true')).toBeInTheDocument();
        expect(screen.getByText('Verified: true')).toBeInTheDocument();
        expect(user.reload).toHaveBeenCalledTimes(1);
        expect(user.getIdToken).toHaveBeenCalledWith(true);
    });

    it('refreshUser() reloads before forcing the token refresh', async () => {
        const user = createUnverifiedUser({ verifiesOnReload: true });
        auth.currentUser = user;
        renderWithUser(user);
        await screen.findByText('Verified: false');

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
        await screen.findByText('Refresh result: true');

        expect(user.reload.mock.invocationCallOrder[0])
            .toBeLessThan(user.getIdToken.mock.invocationCallOrder[0]);
    });

    it('refreshUser() returns false and stays unverified if the user has not verified yet', async () => {
        const user = createUnverifiedUser({ verifiesOnReload: false });
        auth.currentUser = user;
        renderWithUser(user);
        await screen.findByText('Verified: false');

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        expect(await screen.findByText('Refresh result: false')).toBeInTheDocument();
        expect(screen.getByText('Verified: false')).toBeInTheDocument();
    });

    it('refreshUser() returns false without throwing when no user is signed in', async () => {
        renderWithUser(null);
        await screen.findByText('Verified: null');

        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

        expect(await screen.findByText('Refresh result: false')).toBeInTheDocument();
    });
});
