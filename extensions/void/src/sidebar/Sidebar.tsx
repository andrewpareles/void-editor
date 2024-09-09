import React, { useState, ChangeEvent, useEffect, useRef, useCallback, FormEvent } from "react"
import { ApiConfig, LLMMessage, sendLLMMessage } from "../common/sendLLMMessage"
import { Command, File, Selection, WebviewMessage } from "../shared_types"
import { awaitVSCodeResponse, getVSCodeAPI, resolveAwaitingVSCodeResponse } from "./getVscodeApi"

import { marked } from 'marked';
import MarkdownRender from "./MarkdownRender";

import * as vscode from 'vscode'


const filesStr = (fullFiles: File[]) => {
	return fullFiles.map(({ filepath, content }) =>
		`
${filepath}
\`\`\`
${content}
\`\`\``).join('\n')
}

const userInstructionsStr = (instructions: string, files: File[], selection: Selection | null) => {
	return `
${filesStr(files)}

${!selection ? '' : `
I am currently selecting this code:
\`\`\`${selection.selectionStr}\`\`\`
`}

Please edit the code following these instructions:
${instructions}`;
}


const ChatBubble = ({ role, children }: { role: 'user' | 'assistant', children: string }) => {

	let chatbubbleContents: React.ReactNode

	// render user messages as text
	if (role === 'user') {
		chatbubbleContents = children
	}

	// render assistant messages as markdown
	else if (role === 'assistant') {
		const tokens = marked.lexer(children); // https://marked.js.org/using_pro#renderer
		chatbubbleContents = <MarkdownRender tokens={tokens} /> // sectionsHTML
	}

	return <div className={`mb-4 ${role === 'user' ? 'text-right' : 'text-left'}`}>
		<div className={`inline-block p-2 rounded-lg ${role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
			{chatbubbleContents}
		</div>
	</div>
}

const getBasename = (pathStr: string) => {
	// "unixify" path
	pathStr = pathStr.replace(/[/\\]+/g, '/'); // replace any / or \ or \\ with /
	const parts = pathStr.split('/') // split on /
	return parts[parts.length - 1]
}

type ChatMessage = {
	role: 'user' | 'assistant',
	content: string, // content sent to the llm
	displayContent: string, // content displayed to user
}


// const [stateRef, setState] = useInstantState(initVal)
// setState instantly changes the value of stateRef instead of having to wait till the next render to have it (useful for javascript + logic)
// re-renders happen like any other useState()
export const useInstantState = <T,>(initVal: T) => {
	const stateRef = useRef<T>(initVal)
	const [_, setS] = useState<T>(initVal)
	const setState = useCallback((newVal: T) => {
		setS(newVal);
		stateRef.current = newVal;
	}, [])
	return [stateRef as React.RefObject<T>, setState] as const // make s.current readonly; setState handles changes.
}


const Sidebar = () => {

	// state of current message
	const [selection, setSelection] = useState<Selection | null>(null) // the code the user is selecting
	const [files, setFiles] = useState<vscode.Uri[]>([]) // the names of the files in the chat
	const [instructions, setInstructions] = useState('') // the user's instructions

	// state of chat
	const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
	const [messageStream, setMessageStream] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const abortFnRef = useRef<(() => void) | null>(null)

	const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null)

	// get Api Config on mount
	useEffect(() => {
		getVSCodeAPI().postMessage({ type: 'getApiConfig' })
	}, [])

	// Receive messages from the extension
	useEffect(() => {
		const listener = (event: MessageEvent) => {

			const m = event.data as WebviewMessage;
			// resolve any awaiting promises
			// eg. it will resolve the promise below for `await VSCodeResponse('files')`
			resolveAwaitingVSCodeResponse(m)

			// if user pressed ctrl+l, add their selection to the sidebar
			if (m.type === 'ctrl+l') {

				setSelection(m.selection)

				const filepath = m.selection.filePath

				// add file if it's not a duplicate
				if (!files.find(f => f.fsPath === filepath.fsPath)) setFiles(files => [...files, filepath])

			}
			// when get apiConfig, set
			else if (m.type === 'apiConfig') {
				setApiConfig(m.apiConfig)
			}

		}
		window.addEventListener('message', listener);
		return () => { window.removeEventListener('message', listener) }
	}, [files, selection])


	const formRef = useRef<HTMLFormElement | null>(null)
	const onSubmit = async (e: FormEvent<HTMLFormElement>) => {

		e.preventDefault()
		if (isLoading) return

		setIsLoading(true)
		setInstructions('');
		formRef.current?.reset(); // reset the form's text
		setSelection(null)
		setFiles([])

		// request file content from vscode and await response
		getVSCodeAPI().postMessage({ type: 'requestFiles', filepaths: files })
		const relevantFiles = await awaitVSCodeResponse('files')

		// add message to chat history
		const content = userInstructionsStr(instructions, relevantFiles.files, selection)
		const newHistoryElt: ChatMessage = { role: 'user', content, displayContent: instructions, }
		setChatHistory(chatHistory => [...chatHistory, newHistoryElt])

		// send message to claude
		let { abort } = sendLLMMessage({
			messages: [...chatHistory.map(m => ({ role: m.role, content: m.content })), { role: 'user', content }],
			onText: (newText, fullText) => setMessageStream(fullText),
			onFinalMessage: (content) => {

				// add assistant's message to chat history
				const newHistoryElt: ChatMessage = { role: 'assistant', content, displayContent: content, }
				setChatHistory(chatHistory => [...chatHistory, newHistoryElt])

				// clear selection
				setMessageStream('')
				setIsLoading(false)
			},
			apiConfig: apiConfig
		})
		abortFnRef.current = abort

	}

	const onStop = useCallback(() => {
		// abort claude
		abortFnRef.current?.()

		// if messageStream was not empty, add it to the history
		const llmContent = messageStream || '(canceled)'
		const newHistoryElt: ChatMessage = { role: 'assistant', displayContent: messageStream, content: llmContent }
		setChatHistory(chatHistory => [...chatHistory, newHistoryElt])

		setMessageStream('')
		setIsLoading(false)

	}, [messageStream])

	return <>
		<div className="flex flex-col h-full">
			<div className="flex-grow overflow-y-auto p-4">
				{/* previous messages */}
				{chatHistory.map((message, i) => (
					<ChatBubble key={i} role={message.role}>
						{message.displayContent}
					</ChatBubble>
				))}
				{/* message stream */}
				<ChatBubble role={'assistant'}>
					{messageStream}
				</ChatBubble>
			</div>
			{/* chatbar */}
			<div className="p-4 border-t">
				{/* selection */}
				<div className="text-left">
					{/* selected files */}
					<div>
						{files.map((filename, i) =>
							<div key={i} className='flex'>
								{/* X button on a file */}
								<button type='button' onClick={() => {
									let file_index = files.indexOf(filename)
									setFiles([...files.slice(0, file_index), ...files.slice(file_index + 1, Infinity)])
								}}>X</button>
								<div className='text-xs'>{getBasename(filename.fsPath)}</div>
							</div>
						)}
					</div>
					{/* selected code */}
					<div className="inline-block p-2 rounded-lg bg-gray-200 text-black">
						{selection?.selectionStr}
					</div>
				</div>
				<form
					ref={formRef}
					className="flex"
					onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) onSubmit(e) }}

					onSubmit={(e) => {
						console.log('submit!')
						e.preventDefault();
						onSubmit(e)
					}}>
					{/* input */}

					<textarea
						onChange={(e) => { setInstructions(e.target.value) }}
						className="appearance-none border-none rounded-l-lg w-full py-3 px-5 text-black bg-white leading-tight focus:outline-none focus:shadow-outline resize-none overflow-y-auto transition-height duration-200 max-h-[50vh]"
						placeholder="Type your message..."
						rows={1}
						onInput={e => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }} // Adjust height dynamically
					/>


					{/* submit button */}
					{isLoading ?
						<button
							onClick={onStop}
							className="bg-gray-500 text-white p-2 rounded-r-lg"
							type='button'
						>Stop</button>
						: <button
							className="bg-blue-500 text-white p-2 rounded-r-lg"
							disabled={!instructions}
							type='submit'
						>Submit
						</button>
					}
				</form>
			</div>
		</div>

	</>

}

export default Sidebar
