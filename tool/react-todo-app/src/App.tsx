import { useState, useEffect } from 'react'
import './App.css'

interface Todo {
  id: number
  text: string
  completed: boolean
}

type FilterType = 'all' | 'active' | 'completed'

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('todos')
    return saved ? JSON.parse(saved) : []
  })
  const [inputValue, setInputValue] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  const addTodo = () => {
    if (inputValue.trim() === '') return
    const newTodo: Todo = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false
    }
    setTodos([...todos, newTodo])
    setInputValue('')
  }

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  const toggleComplete = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id)
    setEditValue(todo.text)
  }

  const saveEdit = (id: number) => {
    if (editValue.trim() === '') return
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: editValue.trim() } : todo
    ))
    setEditingId(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const activeCount = todos.filter(todo => !todo.completed).length
  const completedCount = todos.filter(todo => todo.completed).length

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTodo()
  }

  const handleEditKeyPress = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') saveEdit(id)
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="app">
      <div className="container">
        <h1>📝 Todo List</h1>
        
        <div className="input-section">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="添加新任务..."
            className="todo-input"
          />
          <button onClick={addTodo} className="add-btn">添加</button>
        </div>

        <div className="filter-section">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部 ({todos.length})
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            进行中 ({activeCount})
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            已完成 ({completedCount})
          </button>
        </div>

        <div className="stats">
          <span>总计: {todos.length}</span>
          <span>进行中: {activeCount}</span>
          <span>已完成: {completedCount}</span>
        </div>

        <ul className="todo-list">
          {filteredTodos.map((todo, index) => (
            <li
              key={todo.id}
              className={`todo-item ${todo.completed ? 'completed' : ''} ${editingId === todo.id ? 'editing' : ''}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {editingId === todo.id ? (
                <div className="edit-mode">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyPress={(e) => handleEditKeyPress(e, todo.id)}
                    className="edit-input"
                    autoFocus
                  />
                  <div className="edit-actions">
                    <button onClick={() => saveEdit(todo.id)} className="save-btn">✓</button>
                    <button onClick={cancelEdit} className="cancel-btn">✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleComplete(todo.id)}
                    className="checkbox"
                  />
                  <span className="todo-text">{todo.text}</span>
                  <div className="actions">
                    <button onClick={() => startEditing(todo)} className="edit-btn">✏️</button>
                    <button onClick={() => deleteTodo(todo.id)} className="delete-btn">🗑️</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {filteredTodos.length === 0 && (
          <p className="empty-message">暂无任务，添加一个开始吧！</p>
        )}
      </div>
    </div>
  )
}

export default App
