import { lazy } from "solid-js";
import "./app.css";

const Menu = lazy(() => import("./components/menu"));
export default function App() {
	return <Menu />;
}
