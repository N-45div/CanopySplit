import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const About = () => {
	return (
		<div className="mx-auto max-w-4xl space-y-8 p-8">
			<header>
				<h1 className="text-3xl font-bold">About This Template</h1>
				<p className="mt-2 text-muted-foreground">
					A minimal, production-ready boilerplate for the Octant v2 Hackathon
				</p>
			</header>

			<Card className="p-6">
				<h2 className="mb-4 text-xl font-semibold">What's Included</h2>
				<ul className="list-inside list-disc space-y-2 text-sm">
					<li>React 19 with TypeScript</li>
					<li>Vite for fast builds and HMR</li>
					<li>Tailwind CSS v4 for styling</li>
					<li>ShadCN UI components</li>
					<li>React Router v7 for navigation</li>
					<li>Zustand for state management</li>
					<li>React Hook Form + Zod for forms</li>
					<li>Lucide React for icons</li>
				</ul>
			</Card>

			<Card className="p-6">
				<h2 className="mb-4 text-xl font-semibold">Getting Started</h2>
				<ol className="list-inside list-decimal space-y-2 text-sm">
					<li>Start building your features in <code className="rounded bg-muted px-1">src/pages/</code></li>
					<li>Add new routes in <code className="rounded bg-muted px-1">src/App.tsx</code></li>
					<li>Use ShadCN components from <code className="rounded bg-muted px-1">src/components/ui/</code></li>
					<li>Style with Tailwind utility classes</li>
					<li>Manage global state with Zustand</li>
				</ol>
			</Card>

			<Link to="/">
				<Button variant="outline">← Back to Home</Button>
			</Link>
		</div>
	);
};

export default About;