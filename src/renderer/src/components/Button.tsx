import type { Component, JSX } from "solid-js";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "custom";
	size?: "sm" | "md" | "lg";
	children: JSX.Element;
	class?: string;
}

const Button: Component<ButtonProps> = (props) => {
	const {
		variant = "primary",
		size = "md",
		class: className = "",
		children,
		...rest
	} = props;

	const baseClasses =
		"border-2 border-white font-bold transition-all duration-200 ease-in-out hover:cursor-pointer hover:-translate-y-0.5 active:translate-y-0";

	const sizeClasses = {
		sm: "text-xs px-4 py-2",
		md: "text-base px-4 py-2",
		lg: "text-lg px-6 py-3",
	};

	const variantClasses = {
		primary: "bg-transparent text-white hover:bg-white hover:text-black",
		secondary:
			"bg-transparent text-white hover:bg-white hover:text-black opacity-80",
		custom: "",
	};

	const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

	return (
		<button type="button" class={classes} {...rest}>
			{children}
		</button>
	);
};

export default Button;
