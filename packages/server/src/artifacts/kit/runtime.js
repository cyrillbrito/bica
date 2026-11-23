// The artifact kit in the page (docs/artifacts.md): kit.ts serves it after
// ECharts and before Tailwind's browser build, with its config filled in.
// It adds the themes' CSS, picks the theme and light or dark, gives ECharts a
// theme made from the tokens, and follows the viewer's picks.
((config) => {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const MODES = ['light', 'dark', 'system'];
  const known = (id) => (config.themes.includes(id) ? id : undefined);
  // The viewer's pick, then the page's own `data-theme`, then the default.
  let theme =
    known(params.get('theme')) ?? known(root.dataset.theme) ?? config.themes[0];
  let mode = MODES.includes(params.get('mode'))
    ? params.get('mode')
    : config.mode;
  const systemDark = matchMedia('(prefers-color-scheme: dark)');

  // First in <head>, so the page's own styles come after and win.
  const style = document.createElement('style');
  style.dataset.kit = '';
  style.textContent = config.css;
  document.head.prepend(style);
  if (config.tailwind) {
    const source = document.createElement('style');
    source.type = 'text/tailwindcss';
    source.textContent = config.tailwind;
    document.head.append(source);
  }

  const token = (name) =>
    getComputedStyle(root).getPropertyValue(`--${name}`).trim();

  // Charts never set colors: they get the theme's, and change with it.
  function chartTheme() {
    const fg = token('fg');
    const muted = token('muted');
    const line = token('line');
    const axis = {
      axisLine: { lineStyle: { color: line } },
      axisTick: { lineStyle: { color: line } },
      axisLabel: { color: muted },
      splitLine: { lineStyle: { color: [line] } },
      splitArea: { areaStyle: { color: ['transparent'] } },
      nameTextStyle: { color: muted },
    };
    return {
      color: [1, 2, 3, 4, 5, 6].map((i) => token(`chart-${i}`)),
      backgroundColor: 'transparent',
      textStyle: { color: fg, fontFamily: token('text-font') },
      title: {
        textStyle: { color: fg, fontFamily: token('heading-font') },
        subtextStyle: { color: muted },
      },
      legend: { textStyle: { color: muted }, pageTextStyle: { color: muted } },
      tooltip: {
        backgroundColor: token('surface'),
        borderColor: line,
        textStyle: { color: fg },
        axisPointer: {
          lineStyle: { color: muted },
          crossStyle: { color: muted },
        },
      },
      categoryAxis: axis,
      valueAxis: axis,
      logAxis: axis,
      timeAxis: axis,
      radar: {
        axisName: { color: muted },
        axisLine: { lineStyle: { color: line } },
        splitLine: { lineStyle: { color: line } },
        splitArea: { areaStyle: { color: ['transparent'] } },
      },
      gauge: {
        axisLine: { lineStyle: { color: [[1, line]] } },
        axisLabel: { color: muted },
        detail: { color: fg },
      },
      visualMap: { textStyle: { color: muted } },
      dataZoom: {
        textStyle: { color: muted },
        borderColor: line,
        fillerColor: 'transparent',
      },
      markLine: { lineStyle: { color: muted } },
      pie: { itemStyle: { borderColor: token('bg') } },
      bar: { itemStyle: { borderRadius: 0 } },
      line: { symbolSize: 6, lineStyle: { width: 2 } },
    };
  }

  const charts = new Set();
  const echarts = window.echarts;
  if (echarts) {
    const init = echarts.init;
    // `echarts.init(el)` with no theme gets the kit's and follows it; a page
    // that names a theme keeps its own.
    echarts.init = (dom, theme, opts) => {
      const own = theme == null;
      const chart = init(dom, own ? chartTheme() : theme, opts);
      if (own) charts.add(chart);
      new ResizeObserver(() => chart.isDisposed() || chart.resize()).observe(
        dom,
      );
      return chart;
    };
  }

  function apply() {
    const dark = mode === 'dark' || (mode === 'system' && systemDark.matches);
    root.dataset.theme = theme;
    root.dataset.mode = dark ? 'dark' : 'light';
    if (charts.size) {
      const next = chartTheme();
      for (const chart of charts)
        if (chart.isDisposed()) charts.delete(chart);
        else chart.setTheme(next);
    }
    // For a page's own canvas or SVG code that reads the tokens.
    dispatchEvent(new CustomEvent('kit:theme', { detail: { theme, mode } }));
  }

  apply();
  systemDark.addEventListener('change', () => mode === 'system' && apply());

  window.kit = {
    token,
    get theme() {
      return theme;
    },
    get mode() {
      return root.dataset.mode;
    },
  };

  // The viewer sends the picks with postMessage, since the sandbox gives the
  // page an origin of its own and Bica can't reach into it.
  addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== parent || data?.type !== 'bica-kit:theme') return;
    theme = known(data.theme) ?? theme;
    if (MODES.includes(data.mode)) mode = data.mode;
    apply();
  });

  // When the file changes the viewer reloads it, and passes back where it
  // was scrolled so the reader keeps their place.
  if (parent !== window) {
    const y = Number(params.get('scroll'));
    if (y) addEventListener('load', () => scrollTo(0, y));
    let timer;
    addEventListener(
      'scroll',
      () => {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            parent.postMessage({ type: 'bica-kit:scroll', y: scrollY }, '*'),
          150,
        );
      },
      { passive: true },
    );
  }
})(KIT_CONFIG);
