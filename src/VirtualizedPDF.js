import React, { useState, useEffect, useRef } from 'react'
import { List as VList, AutoSizer, List } from 'react-virtualized'

import * as pdfjs from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry'
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker

import "./VirtualizedPDF.less"
import ScaleButton from './ScaleButton'
import { getViewportWidth, debounce } from './utils'

const MaxPdfWidth = 672

export default function VirtualizedPDF({ src, className }) {

    if (!src) {
        return null
    }

    const listStartIndex = useRef(0)
    const lastPageWidth = useRef(0)
    const pageRenderingQueue = useRef([])
    const listScrollTop = useRef(0)

    const [vListRef, setVListRef] = useState(null)
    const [numPages, setNumPages] = useState([])
    const [pdf, setPdf] = useState(null)
    const [heightDelta, setHeightDelta] = useState(0)

    const screenWidth = getViewportWidth()

    const [itemWidth, setItemWidth] = useState(() => Math.min(screenWidth, MaxPdfWidth))

    const isLargeScreen = screenWidth > MaxPdfWidth

    useEffect(() => {

        const getPageInfo = async (curPdf) => {
            const page = await curPdf.getPage(1)
            const viewport = page.getViewport({ scale: 1 })
            const { width, height } = viewport
            const array = []
            for (let index = 0; index < curPdf.numPages; index++) {
                array.push({ width, height })
            }
            setNumPages(array)
        }

        const fetchPdf = async () => {
            const loadingTask = pdfjs.getDocument(src)
            const curPdf = await loadingTask.promise
            await setPdf(curPdf)
            getPageInfo(curPdf)
        }

        fetchPdf()
    }, [])

    useEffect(() => {
        recomputeListSize()
        const newScrollTop = listScrollTop.current + listStartIndex.current * heightDelta
        scrollToPosition(newScrollTop)
    }, [itemWidth])

    const scrollToPosition = (scrollTop) => {
        if (vListRef && typeof (vListRef.scrollToPosition === 'function')) {
            vListRef.scrollToPosition(scrollTop)
        }
    }

    const scrollToRow = (index) => {
        if (vListRef && typeof (vListRef.scrollToRow === 'function')) {
            vListRef.scrollToRow(index)
        }
    }

    const getPageRatio = () => {
        const { width: pageWidth, height: pageHeight } = (numPages[0] || {})
        if (pageHeight === undefined) {
            return 1
        }
        return pageHeight === 0 ? 1 : pageWidth / pageHeight
    }

    //recompute list grid size
    const recomputeListSize = () => {
        if (vListRef && typeof (vListRef.recomputeGridSize === 'function')) {
            vListRef.recomputeGridSize()
        }
    }

    const getItemHeight = (index, height) => height

    const renderItem = ({ key, index, style, itemWidth }) => {
        const space = 8
        return (
            <div
                key={key}
                style={{
                    ...style,
                    textAlign: "center",
                    paddingBottom: space
                }}>
                <canvas
                    style={{
                        width: itemWidth,
                        height: style.height - space,
                        boxShadow: "0 0 5px 2px #ccc",
                        backgroundColor: "#fff",
                    }}
                    data-page-number={`${index + 1}`} />
            </div>
        )
    }

    const renderPdf = async (pageNum, curPdf) => {
        const page = await curPdf.getPage(pageNum)

        if (pageRenderingQueue.current.some(p => p === pageNum)) {
            return
        }
        // Prepare canvas using PDF page dimensions
        pageRenderingQueue.current = [...pageRenderingQueue.current, pageNum]
        const canvas = document.querySelector(`canvas[data-page-number='${pageNum}']`)
        const context = canvas.getContext('2d')

        const viewport = page.getViewport({ scale: isLargeScreen ? 3 : window.devicePixelRatio })
        const { width, height } = viewport
        canvas.width = width
        canvas.height = height

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        const renderTask = page.render(renderContext)
        renderTask.promise.then(() => {
            pageRenderingQueue.current = pageRenderingQueue.current.filter(p => p !== pageNum)
        })
    }

    return (
        <div className={"pdfReader-container " + (className || "")}>
            <div className="pdfReader-content">
                <AutoSizer onResize={debounce(({ width, height }) => {
                    setItemWidth(() => Math.min(MaxPdfWidth, width))
                    //当可视窗口变化完成300ms后重新计算virtualized list的size，超过最大的pdf宽度则不再计算。
                    if ((width <= MaxPdfWidth || (lastPageWidth.current < MaxPdfWidth && width > MaxPdfWidth)) && pdf) {
                        recomputeListSize()
                    }
                    lastPageWidth.current = width
                }, 300)}>
                    {({ width, height }) => {
                        if (pdf && numPages.length) {
                            const pageRatio = getPageRatio()
                            const rowItemWidth = itemWidth - 20
                            return (
                                <VList
                                    ref={e => setVListRef(e)}
                                    style={{ transform: "translateX(-50%)", padding: 10 }}
                                    overscanRowCount={3}
                                    rowCount={numPages.length}
                                    onScroll={({ scrollTop }) => listScrollTop.current = scrollTop}
                                    width={width}
                                    height={height}
                                    rowHeight={({ index }) => getItemHeight(index, rowItemWidth / pageRatio)}
                                    rowRenderer={({ key, index, style }) => renderItem({ key, index, style, itemWidth: rowItemWidth })}
                                    onRowsRendered={({
                                        overscanStartIndex,
                                        overscanStopIndex,
                                        startIndex,
                                        stopIndex,
                                    }) => {
                                        if (startIndex === 0) {
                                            renderPdf(1, pdf)
                                            renderPdf(2, pdf)
                                        } else {
                                            const pageNum = listStartIndex.current <= startIndex ? stopIndex + 1 : startIndex + 1
                                            renderPdf(pageNum, pdf)
                                        }
                                        listStartIndex.current = startIndex
                                    }}>
                                </VList>
                            )
                        } else {
                            return null
                        }
                    }}
                </AutoSizer>
            </div>
            {isLargeScreen ?
                <div className="pdfReader-scale-button-cot">
                    <ScaleButton
                        icon="plus"
                        style={{ marginBottom: "1rem" }}
                        onClick={() => {
                            const nextWidth = 1.1 * itemWidth
                            const pageRatio = getPageRatio()
                            setItemWidth(nextWidth)
                            setHeightDelta(0.1 * itemWidth / pageRatio)
                        }} />
                    <ScaleButton
                        icon="minus"
                        onClick={() => {
                            const nextWidth = 0.9 * itemWidth
                            const pageRatio = getPageRatio()
                            setItemWidth(nextWidth)
                            setHeightDelta((-0.1) * itemWidth / pageRatio)
                        }}
                    />
                </div> : null
            }
        </div>
    )
}