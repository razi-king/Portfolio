// Package safego runs background goroutines that cannot crash the process.
//
// HTTP middleware only recovers panics inside request handlers. A panic in a
// goroutine started from a handler or a worker kills the whole service, so
// every background goroutine in this project is started through Go.
package safego

import (
	"fmt"
	"log/slog"
	"runtime/debug"
)

// Go runs fn in a new goroutine, recovering and logging any panic.
// onPanic, if not nil, is called with the recovered error (for alerts/metrics).
func Go(name string, fn func(), onPanic func(error)) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				err := fmt.Errorf("panic in goroutine %q: %v", name, r)
				slog.Error("goroutine panicked", "goroutine", name, "panic", r, "stack", string(debug.Stack()))
				if onPanic != nil {
					onPanic(err)
				}
			}
		}()
		fn()
	}()
}
