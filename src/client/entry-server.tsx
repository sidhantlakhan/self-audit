import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './App.tsx';

export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
}
