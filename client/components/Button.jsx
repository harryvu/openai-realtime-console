export default function Button({ icon, children, onClick, className, ...props }) {
  return (
    <button
      className={`bg-gray-800 text-white rounded-full p-4 flex items-center gap-1 hover:opacity-90 whitespace-nowrap ${className}`}
      onClick={onClick}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
