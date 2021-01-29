export function debounce(func, wait, immediate) {
	let timeout;
	return function() {
		let context = this, args = arguments;
		let later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		let callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

export function getViewportWidth() {
    if(typeof(document) === 'undefined') {
        return 0 // TODO server-render default？
    }
    const viewportWidth = Math.max(
        document.documentElement.clientWidth,
        window.innerWidth || 0
    )
    return viewportWidth
}