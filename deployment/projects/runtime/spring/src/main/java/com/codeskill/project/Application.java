package com.codeskill.project;

import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

@SpringBootApplication
@RestController
public class Application {
    public static void main(String[] args) { SpringApplication.run(Application.class, args); }
    @GetMapping("/api/hello")
    public Map<String, String> hello() { return Map.of("message", "Hello from Spring Boot!", "stack", "springboot"); }
    @PostMapping("/api/echo")
    public Map<String, Object> echo(@RequestBody Map<String, Object> body) { return Map.of("received", body); }
    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }
}
