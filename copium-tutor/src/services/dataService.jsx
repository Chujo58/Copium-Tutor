const MEMORY_STORAGE = {
    USER: null,
    USERS: [],
};

export const dataService = {
    getCurrentUser: () => {
        return MEMORY_STORAGE.USER;
    },

    clearCurrentUser: () => {
        MEMORY_STORAGE.USER = null;
    },

    setCurrentUser: (user) => {
        MEMORY_STORAGE.USER = user;
        const users = MEMORY_STORAGE.USERS;
        const exists = users.findIndex(u => u.userid === user.userid)
        if (exists >= 0) {
            users[exists] = user;
        } else {
            users.push(user)
        }

    }
};
