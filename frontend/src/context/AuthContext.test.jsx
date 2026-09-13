import {render, screen, waitFor} from '@testing-library/react';
import {vi, describe,it,expect,beforeEach} from 'vitest';
import {AuthProvider,useAuth} from './AuthContext';

// replacing real firebase/auth module with fake one
vi.mock("firebase/auth", async(importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        onAuthStateChanged: vi.fn(),
    };
});

import { onAuthStateChanged } from 'firebase/auth';

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