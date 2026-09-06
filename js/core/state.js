export const state = {
  user: null,
  route: 'dashboard',
  filters: {
    from: '',
    to: '',
    planting: '',
    product: '',
    client: ''
  }
};

export function setUser(user) {
  state.user = user;
  sessionStorage.setItem('alansa_user', JSON.stringify(user));
}

export function restoreUser() {
  try {
    state.user = JSON.parse(sessionStorage.getItem('alansa_user') || 'null');
  } catch {
    state.user = null;
  }
  return state.user;
}

export function logout() {
  state.user = null;
  sessionStorage.removeItem('alansa_user');
}
