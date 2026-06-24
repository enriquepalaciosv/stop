import { useEffect, useState } from 'react'

// Altura del viewport VISIBLE (descontando el teclado en móvil) vía VisualViewport API.
// Permite mantener los botones por encima del teclado.
export function useViewportHeight(): number {
  const [height, setHeight] = useState(
    () => window.visualViewport?.height ?? window.innerHeight,
  )

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setHeight(vv.height)
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return height
}
