export function printPage(delay = 300) {
  window.setTimeout(async () => {
    if (window.electronAPI?.print) {
      try {
        const result = await window.electronAPI.print()
        if (result && !result.success && !/cancel/i.test(result.error || '')) {
          window.alert(`Print failed: ${result.error || 'The document could not be printed.'}`)
        }
      } catch (error) {
        console.error('Print failed', error)
        window.alert(`Print failed: ${error.message}`)
      }
      return
    }

    window.print()
  }, delay)
}