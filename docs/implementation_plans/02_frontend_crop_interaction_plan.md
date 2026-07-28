# 图片前端交互式剪裁方案设计文档

## 1. 目标描述 (Goal Description)
当前 `PreviewerView.jsx` 中的图片剪裁工具仅展示了一个静态的绿色虚线框（具有视觉效果），但缺少对应的鼠标拖拽和缩放交互事件绑定，导致用户无法实际框选想要的区域。
本方案旨在通过给剪裁框补充完整的 React 鼠标事件（Mouse Events）处理，使其成为一个真正可用、丝滑的交互式裁剪工具。

## 2. 交互需求与边界条件
- **整体拖拽**：用户按住虚线框内部时，可随意在图片范围内拖拽移动整个剪裁框。
- **边缘缩放 (Handles)**：虚线框的四个角（左上 nw、右上 ne、左下 sw、右下 se）支持拖拽缩放大小。
- **边界控制 (Bound Check)**：拖拽和缩放时，剪裁框的坐标（x, y, w, h）不能超出图片的物理边界 (0% ~ 100%)。
- **兼容性**：使用百分比坐标制，无论用户是否对图片进行了放大/缩小/适应窗口等操作，剪裁框的缩放与拖拽始终基于底层图片真实可视尺寸进行换算。

## 3. 具体技术实现方案

### 3.1 状态管理 (State Management)
新增用于跟踪拖拽动作的 React State：
```javascript
const [dragInfo, setDragInfo] = useState({
  isDragging: false,      // 是否正在拖动
  action: null,           // 'move' | 'nw' | 'ne' | 'sw' | 'se'
  startX: 0,              // 鼠标初始 X
  startY: 0,              // 鼠标初始 Y
  startBox: null          // 拖拽开始时框的初始状态 {x, y, w, h}
});
```

### 3.2 鼠标事件绑定 (Event Handlers)
1. **`onMouseDown`**: 
   绑定在剪裁框及其四个角的小方块上。触发时记录当前的 `clientX/clientY` 和 `cropBox` 初始坐标，并阻止事件冒泡。
2. **`onMouseMove` (全局绑定至 document)**: 
   在拖拽状态下，计算鼠标的横纵向偏移量，并根据图片容器的真实宽高，将其转换为百分比偏移 `%`。
   - 如果是 `move`：直接更新 `cropBox` 的 `x` 和 `y`。
   - 如果是 `se` (右下角)：更新 `cropBox` 的 `w` 和 `h`。
   - 同理计算另外三个角的反向缩放坐标补偿。
3. **`onMouseUp` (全局绑定至 document)**: 
   拖拽结束，清理状态并移除 document 监听器。

### 3.3 百分比计算与边界限制核心逻辑
假设图片容器节点的渲染宽度为 `imgW`，高度为 `imgH`，拖动产生的像素偏移为 `deltaX` 和 `deltaY`：
- **偏移百分比**: `percentX = (deltaX / imgW) * 100`，`percentY = (deltaY / imgH) * 100`。
- **边界收束 (以 move 为例)**:
  ```javascript
  let newX = Math.max(0, Math.min(startBox.x + percentX, 100 - startBox.w));
  let newY = Math.max(0, Math.min(startBox.y + percentY, 100 - startBox.h));
  ```

## 4. 待修改文件清单
#### [MODIFY] [PreviewerView.jsx](file:///Users/superli/Desktop/aiwork/文件管理器demo/src/components/PreviewerView.jsx)
- 在组件顶层加入对拖拽状态的控制。
- 补充 `handleCropMouseDown` 等相关核心逻辑函数。
- 在渲染 `isCropping` 的遮罩 DOM 时，为对应的边框和中心区域注入 `onMouseDown` 属性。
