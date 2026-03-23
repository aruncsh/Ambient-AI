export const auth = {
  login: async (credentials: any) => {
    // Mock login
    localStorage.setItem('token', 'mock-token');
    return { user: { name: '' } };
  },
  logout: () => {
    localStorage.removeItem('token');
  },
  getToken: () => localStorage.getItem('token')
};
