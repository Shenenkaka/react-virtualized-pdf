import React from 'react'

export default function ScaleButton(props) {
    const { icon, onClick, className, style } = props

    function renderIcon(icon) {
        if (icon === 'plus') {
            return '+'
        } else if (icon === 'minus') {
            return '-'
        } else {
            return null
        }
    }
    return (
        <div
            style={style}
            className={"scale-button " + (className || '')}
            onClick={onClick} >
            <span className="scale-button-icon">
                {renderIcon(icon)}
            </span>
        </div>
    )
}
