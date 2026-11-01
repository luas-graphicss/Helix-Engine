import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;
import java.util.ArrayList;
import java.util.List;
import org.teavm.backend.javascript.JSModuleType;
import org.teavm.diagnostics.Problem;
import org.teavm.diagnostics.ProblemSeverity;
import org.teavm.model.CallLocation;
import org.teavm.model.TextLocation;
import org.teavm.tooling.TeaVMTargetType;
import org.teavm.tooling.TeaVMTool;
import org.teavm.tooling.TeaVMToolLog;
import org.teavm.vm.TeaVMOptimizationLevel;

   
                                                                              
                                                                             
                                                                                  
                                                                               
             
   
public final class HelixBuild {
    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.err.println("uso: HelixBuild <classpath> <saída> <classe de entrada>");
            System.exit(2);
        }
        List<URL> urls = new ArrayList<>();
        for (String entry : args[0].split(File.pathSeparator)) {
            if (!entry.isEmpty()) urls.add(new File(entry).toURI().toURL());
        }
        TeaVMTool tool = new TeaVMTool();
        tool.setClassLoader(new URLClassLoader(urls.toArray(new URL[0]), HelixBuild.class.getClassLoader()));
        tool.setTargetDirectory(new File(args[1]));
        tool.setTargetFileName("script.js");
        tool.setTargetType(TeaVMTargetType.JAVASCRIPT);
        tool.setJsModuleType(JSModuleType.COMMON_JS);
        tool.setMainClass(args[2]);
        tool.setEntryPointName(null);
        tool.setOptimizationLevel(TeaVMOptimizationLevel.SIMPLE);
        tool.setObfuscated(false);
        tool.setStrict(true);
        tool.setDebugInformationGenerated(false);
        tool.setSourceMapsFileGenerated(true);
        tool.setIncremental(false);
        tool.setLog(new QuietLog());
        tool.generate();

        boolean failed = false;
        for (Problem problem : tool.getProblemProvider().getProblems()) {
            boolean error = problem.getSeverity() == ProblemSeverity.ERROR;
            failed |= error;
            String file = null;
            int line = 0;
            CallLocation location = problem.getLocation();
            if (location != null && location.getSourceLocation() != null) {
                TextLocation text = location.getSourceLocation();
                file = text.getFileName();
                line = text.getLine();
            }
            String method = location != null && location.getMethod() != null ? location.getMethod().toString() : null;
            System.out.println("{\"severity\":\"" + (error ? "error" : "warning") + "\",\"text\":\"" + escape(problem.getText())
                    + "\",\"file\":" + (file == null ? "null" : "\"" + escape(file) + "\"") + ",\"line\":" + line
                    + ",\"method\":" + (method == null ? "null" : "\"" + escape(method) + "\"") + "}");
        }
        System.exit(failed ? 1 : 0);
    }

    private static String escape(String text) {
        StringBuilder out = new StringBuilder(text.length() + 8);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        return out.toString();
    }

                                                                                 
    private static final class QuietLog implements TeaVMToolLog {
        @Override public void info(String text) {}
        @Override public void debug(String text) {}
        @Override public void warning(String text) { System.err.println("warning: " + text); }
        @Override public void error(String text) { System.err.println("error: " + text); }
        @Override public void info(String text, Throwable e) {}
        @Override public void debug(String text, Throwable e) {}
        @Override public void warning(String text, Throwable e) { System.err.println("warning: " + text + ": " + e); }
        @Override public void error(String text, Throwable e) { System.err.println("error: " + text + ": " + e); }
    }
}
