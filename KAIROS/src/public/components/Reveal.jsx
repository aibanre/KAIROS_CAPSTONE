import { useEffect, useRef, useState } from 'react'

function isInViewport(element) {
	const bounds = element.getBoundingClientRect()
	return bounds.top < window.innerHeight && bounds.bottom > 0
}

export function Reveal({ delay = 0, as: Component = 'div', className = '', children }) {
	const elementRef = useRef(null)
	const [visible, setVisible] = useState(() => {
		if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return true
		return false
	})

	useEffect(() => {
		const element = elementRef.current
		if (!element) return undefined

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reducedMotion || isInViewport(element) || !('IntersectionObserver' in window)) {
			setVisible(true)
			return undefined
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true)
					observer.disconnect()
				}
			},
			{ threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	return (
		<Component
			ref={elementRef}
			className={`${visible ? 'reveal-visible' : 'reveal'} ${className}`.trim()}
			style={{ '--reveal-delay': `${delay}ms`, transitionDelay: visible ? `${delay}ms` : undefined }}
		>
			{children}
		</Component>
	)
}
