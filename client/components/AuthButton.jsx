import { LogIn, LogOut, User } from 'react-feather';

export function AuthButton({ user, onLogin, onLogout, provider = null, isLoading = false }) {
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User size={16} />
          <span>{user.name}</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
            {user.provider}
          </span>
        </div>
        <button
          onClick={onLogout}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <LogOut size={16} />
          {isLoading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    );
  }

  const getProviderInfo = (provider) => {
    switch (provider) {
      case 'google':
        return { name: 'Google', color: 'bg-red-500 hover:bg-red-600', icon: '🔍' };
      case 'facebook':
        return { name: 'Facebook', color: 'bg-blue-600 hover:bg-blue-700', icon: '📘' };
      case 'microsoft':
        return { name: 'Microsoft', color: 'bg-blue-500 hover:bg-blue-600', icon: 'Ⓜ️' };
      default:
        return { name: 'Login', color: 'bg-gray-500 hover:bg-gray-600', icon: '🔐' };
    }
  };

  const providerInfo = getProviderInfo(provider);

  return (
    <button
      onClick={() => onLogin(provider)}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${providerInfo.color}`}
    >
      <span>{providerInfo.icon}</span>
      <LogIn size={16} />
      {isLoading ? 'Connecting...' : `Login with ${providerInfo.name}`}
    </button>
  );
}