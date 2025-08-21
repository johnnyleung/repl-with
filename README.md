# repl-with

**🚀 A zero-setup interactive Node.js REPL with your favorite NPM packages.**

Tired of spinning up a new project just to try out a library?

`repl-with` lets you drop straight into a Node.js REPL with any NPM package preloaded — perfect for exploring libraries, quick experiments, testing code snippets, and more.

## ✨ Features


- ⚡ **Zero setup**: No install required
- 📦 **Multiple packages**: Load multiple packages at once
- 🔢 **Multiple versions**: Compare different versions of the same package side-by-side

## 🚀 Quick Start

```bash
# Try out Lodash in your CLI!
npx repl-with _=lodash
```
```javascript
// Interactive REPL with Lodash imported as `_`
> _.map([1, 2, 3], x => x * 2)
[2, 4, 6]
```

## 📋 Requirements

- Node.js 16.9.0 or above

## 📖 Usage Examples

### Basic Library Usage

```bash
npx repl-with lodash
```
```javascript
> lodash.sum([1, 2, 3])
6
> lodash.map([1, 2, 3], x => x * 2)
[2, 4, 6]
```

### Load Multiple Libraries

```bash
npx repl-with lodash moment
```
```javascript
> lodash.sum([1, 2, 3])
6
> moment().format('YYYY-MM-DD')
'2025-08-16'
```

### Using Aliases

Use aliases to make your life easier, or to import package names that are not valid JavaScript variable names.
```bash
npx repl-with _=lodash prettyBytes=pretty-bytes
```
```javascript
> _.sum([1, 2, 3])
6
> prettyBytes(1234)
'1.23 kB'
```

### Version Comparison

Use aliases to install multiple versions of the same library side-by-side:

```bash
npx repl-with lodash3=lodash@3.0.0 lodash4=lodash@4.0.0
```
```javascript
> lodash3.VERSION
'3.0.0'
> lodash4.VERSION
'4.0.0'
```

## 💡 Tips

### ES Modules: Default Export

For compatibility reasons, you need to use `.default` to access default exports in ES modules:

```bash
npx repl-with axios chalk
```
```javascript
> axios.default.get('https://api.github.com/users/octocat')
Promise { <pending> }
> console.log(chalk.default.blue('Hello World!'))
'Hello World!' // (in blue color)
```

🪄 For your convenience, if the default export is the _only_ export, then it will be automatically assigned to the variable name:

```bash
npx repl-with prettyBytes=pretty-bytes
```
```javascript
> prettyBytes(1234)
'1.23 kB'
```

### Top-level Await

`repl-with` requires Node.js 16.9.0 or above, which supports top-level await.
```bash
npx repl-with axios
```
```javascript
> axios.default.get('https://api.github.com/users/octocat')
Promise {
    <pending>
...

> await axios.default.get('https://api.github.com/users/octocat')
{
  status: 200,
...
```

## 🛠️ Built-in Commands

All standard Node.js REPL commands are supported (`.clear`, `.help`, etc.) plus these enhanced commands:

### `.debug`
Show debugging information about loaded packages.

### `.import`
Dynamically import additional NPM packages during the session:

```javascript
.import d=date-fns _=lodash
```

### `.packages`
List all available packages in the current session.
